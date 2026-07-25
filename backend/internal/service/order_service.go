package service

import (
	"context"
	"crypto/subtle"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// PlaceOrderInput carries the validated customer submission from the handler.
type PlaceOrderInput struct {
	CustomerName     string
	CustomerPhone    string
	DeliveryAddress  string
	DeliveryDivision string
	DeliveryDistrict string
	Note             string
	Items            []OrderItemInput

	// Advance-payment proof: only consulted when the shop's delivery
	// settings have AdvancePaymentRequired = true. All three fields are
	// required together when the shop demands proof.
	AdvancePaymentMethodID string
	AdvancePaymentTxnRef   string
	AdvancePaymentReceipt  string

	// ReservationID, when set, tells PlaceOrder to consume a cart
	// reservation instead of decrementing stock at place time. Items
	// in this struct are ignored — the repository sources them from
	// the reservation row.
	ReservationID string
}

// SubmitAdvanceProofInput is the buyer-facing payload for submitting or
// editing advance-payment proof on a still-pending order.
type SubmitAdvanceProofInput struct {
	CustomerPhone   string
	PaymentMethodID string
	TxnRef          string
	Receipt         string
}

// BuyerEditOrderInput is the buyer-facing payload for editing delivery
// details before the seller confirms the order.
type BuyerEditOrderInput struct {
	CustomerPhone    string
	DeliveryAddress  string
	DeliveryDivision string
	DeliveryDistrict string
	Note             string
}

type OrderItemInput struct {
	ProductID string
	Quantity  int
}

// validTransitions defines which status transitions a seller can perform.
// Reverse edges (e.g. confirmed→pending) act as one-step undo for accidental clicks.
// cancelled→pending is special: it re-decrements stock via RestoreCancelledOrder.
var validTransitions = map[string][]string{
	"pending":   {"confirmed", "cancelled"},
	"confirmed": {"shipped", "cancelled", "pending"},
	"shipped":   {"delivered", "returned", "confirmed"},
	"delivered": {"shipped"},
	"returned":  {"shipped"},
	"cancelled": {"pending"},
}

// OrderEventPublisher receives order lifecycle events for downstream
// integrations (currently Meta conversion tracking). It is optional: when nil
// the order flow behaves exactly as before.
//
// Implementations must be non-blocking and must never return an error that
// affects the order — a tracking failure is not a checkout failure.
type OrderEventPublisher interface {
	PublishOrderEvent(ctx context.Context, order *domain.Order, eventName string) error
}

// OrderService orchestrates order placement: price look-up, delivery charge
// calculation, COD/advance-payment checks, and transactional stock decrement.
type OrderService struct {
	shops    repository.ShopRepository
	delivery repository.DeliverySettingsRepository
	products repository.ProductRepository
	orders   repository.OrderRepository
	methods  repository.PaymentMethodRepository
	reserves repository.CartReservationRepository

	events OrderEventPublisher
	log    *slog.Logger
}

// SetEventPublisher attaches a lifecycle event publisher. Kept out of the
// constructor so existing callers and tests are unaffected.
func (s *OrderService) SetEventPublisher(p OrderEventPublisher, log *slog.Logger) {
	s.events = p
	if log == nil {
		log = slog.Default()
	}
	s.log = log
}

// publish reports a lifecycle event, swallowing (but logging) any failure.
// Conversion tracking must never break an order.
func (s *OrderService) publish(ctx context.Context, order *domain.Order, eventName string) {
	if s.events == nil || order == nil {
		return
	}
	if err := s.events.PublishOrderEvent(ctx, order, eventName); err != nil && s.log != nil {
		s.log.Error("publish order event failed",
			"event", eventName, "order_id", order.ID, "error", err)
	}
}

func NewOrderService(
	shops repository.ShopRepository,
	delivery repository.DeliverySettingsRepository,
	products repository.ProductRepository,
	orders repository.OrderRepository,
	methods repository.PaymentMethodRepository,
	reserves repository.CartReservationRepository,
) *OrderService {
	return &OrderService{
		shops:    shops,
		delivery: delivery,
		products: products,
		orders:   orders,
		methods:  methods,
		reserves: reserves,
	}
}

// PlaceOrder creates a new order on the shop identified by slug.
// It recalculates all prices server-side and never trusts client totals.
func (s *OrderService) PlaceOrder(ctx context.Context, slug string, in PlaceOrderInput) (*domain.Order, error) {
	// Resolve the shop (404 if suspended or missing).
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}

	// Load delivery settings to check COD and compute delivery charge.
	ds, err := s.delivery.Get(ctx, shop.ID)
	if err != nil {
		return nil, err
	}
	if !ds.CODEnabled {
		return nil, domain.ErrCheckoutDisabled
	}

	// When the shop demands an advance delivery fee, the buyer must submit
	// proof along with the order. We require all three fields together —
	// chosen method + txn ref + receipt path — and verify the method
	// belongs to this shop.
	var verifiedMethodID *string
	if ds.AdvancePaymentRequired {
		if in.AdvancePaymentMethodID == "" || in.AdvancePaymentTxnRef == "" || in.AdvancePaymentReceipt == "" {
			return nil, domain.ErrAdvancePaymentRequired
		}
		method, err := s.methods.Get(ctx, in.AdvancePaymentMethodID)
		if err != nil {
			return nil, err
		}
		if method.ShopID != shop.ID || !method.IsActive {
			return nil, domain.ErrPaymentMethodNotInShop
		}
		verifiedMethodID = &method.ID
	}

	// When the buyer is checking out against a reservation, source the
	// item list from the reservation row so the ordered quantities match
	// what's actually being held — the buyer can't quietly increase a
	// quantity on the way to placing the order. Stock has already been
	// debited at reserve time, so we skip the per-product stock check.
	itemInputs := in.Items
	if in.ReservationID != "" {
		res, err := s.reserves.Get(ctx, shop.ID, in.ReservationID)
		if err != nil {
			return nil, err
		}
		if res.Status != domain.ReservationStatusActive {
			if res.Status == domain.ReservationStatusConsumed {
				return nil, domain.ErrReservationConsumed
			}
			return nil, domain.ErrReservationExpired
		}
		if time.Now().After(res.ExpiresAt) {
			return nil, domain.ErrReservationExpired
		}
		itemInputs = make([]OrderItemInput, 0, len(res.Items))
		for _, it := range res.Items {
			itemInputs = append(itemInputs, OrderItemInput{
				ProductID: it.ProductID,
				Quantity:  it.Quantity,
			})
		}
	}

	// Build order items by looking up each product's current price and snapshotting it.
	var subtotal float64
	items := make([]domain.OrderItem, 0, len(itemInputs))
	for _, item := range itemInputs {
		p, err := s.products.FindByID(ctx, item.ProductID, shop.ID)
		if err != nil {
			return nil, err
		}
		if !p.IsActive || p.IsArchived {
			return nil, domain.ErrProductNotFound
		}
		// Skip the stock check when consuming a reservation — the units
		// were already taken from products.stock at reserve time, so a
		// `p.Stock < quantity` comparison would compare the *post-hold*
		// number to the same number we held, which is meaningless.
		if in.ReservationID == "" && p.Stock < item.Quantity {
			return nil, domain.ErrInsufficientStock
		}

		unitPrice, _ := strconv.ParseFloat(p.PriceBDT, 64)
		lineTotal := unitPrice * float64(item.Quantity)
		subtotal += lineTotal

		items = append(items, domain.OrderItem{
			ProductID:            p.ID,
			ProductNameSnapshot:  p.Name,
			UnitPriceSnapshotBDT: p.PriceBDT,
			// Freeze supplier cost so profit reporting on this order stays
			// accurate even if the product's cost changes later.
			UnitCostSnapshotBDT: p.CostPriceBDT,
			Quantity:            item.Quantity,
			LineTotalBDT:        fmt.Sprintf("%.2f", lineTotal),
		})
	}

	// Per-division delivery charge with default fallback.
	// Orders are accepted regardless of area.
	deliveryCharge, _ := strconv.ParseFloat(ds.DeliveryCharge, 64)
	division := strings.TrimSpace(in.DeliveryDivision)
	if division != "" {
		for _, z := range ds.DeliveryZones {
			if strings.EqualFold(strings.TrimSpace(z.Division), division) {
				if zoneFee, err := strconv.ParseFloat(z.DeliveryCharge, 64); err == nil {
					deliveryCharge = zoneFee
				}
				break
			}
		}
	}

	// Free delivery when subtotal meets threshold.
	if ds.FreeDeliveryThreshold != nil {
		threshold, _ := strconv.ParseFloat(*ds.FreeDeliveryThreshold, 64)
		if threshold > 0 && subtotal >= threshold {
			deliveryCharge = 0
		}
	}

	total := subtotal + deliveryCharge

	legacyArea := ""
	if division != "" && in.DeliveryDistrict != "" {
		legacyArea = fmt.Sprintf("%s, %s", strings.TrimSpace(in.DeliveryDistrict), division)
	} else if division != "" {
		legacyArea = division
	}

	order := &domain.Order{
		ShopID:                 shop.ID,
		CustomerName:           in.CustomerName,
		CustomerPhone:          normalizePhone(in.CustomerPhone),
		DeliveryAddress:        in.DeliveryAddress,
		DeliveryDivision:       division,
		DeliveryDistrict:       strings.TrimSpace(in.DeliveryDistrict),
		DeliveryArea:           legacyArea,
		Note:                   in.Note,
		SubtotalBDT:            fmt.Sprintf("%.2f", subtotal),
		DeliveryChargeBDT:      fmt.Sprintf("%.2f", deliveryCharge),
		TotalBDT:               fmt.Sprintf("%.2f", total),
		AdvancePaymentRequired: ds.AdvancePaymentRequired,
		Items:                  items,
	}
	if verifiedMethodID != nil {
		order.AdvancePaymentMethodID = verifiedMethodID
		order.AdvancePaymentTxnRef = strings.TrimSpace(in.AdvancePaymentTxnRef)
		order.AdvancePaymentReceipt = strings.TrimSpace(in.AdvancePaymentReceipt)
	}
	if in.ReservationID != "" {
		// Best-effort: stamp the buyer's phone on the reservation row
		// so admins can match a hold to a person. Never fatal.
		_ = s.reserves.AttachPhone(ctx, in.ReservationID, order.CustomerPhone)
		rid := in.ReservationID
		order.ReservationID = &rid
	}

	if err := s.orders.PlaceOrder(ctx, order); err != nil {
		return nil, err
	}

	// Tell Meta a purchase happened so ad targeting learns from it.
	s.publish(ctx, order, "Purchase")

	return order, nil
}

// GetShopOrders returns orders for the shop owned by ownerUserID with optional filters.
func (s *OrderService) GetShopOrders(ctx context.Context, ownerID, page, size, status, phone string) ([]*domain.Order, error) {
	limit, offset := paginationDefaults(page, size)
	status = strings.TrimSpace(strings.ToLower(status))
	phone = normalizePhone(phone)
	orders, err := s.orders.OrderListByShopOwner(ctx, ownerID, status, phone, limit, offset)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, orders...); err != nil {
		return nil, err
	}
	return orders, nil
}

func (s *OrderService) GetShopOrderByID(ctx context.Context, ownerID, orderID string) (*domain.Order, error) {
	order, err := s.orders.OrderByIDForShopOwner(ctx, ownerID, orderID)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// UpdateOrderStatus validates the transition and persists the new status.
// A cancellation reason is required when the target status is "cancelled".
func (s *OrderService) UpdateOrderStatus(ctx context.Context, ownerID, orderID, newStatus string, cancellationReason *string) (*domain.Order, error) {
	newStatus = strings.TrimSpace(strings.ToLower(newStatus))

	// Require cancellation reason when cancelling.
	if newStatus == "cancelled" {
		if cancellationReason == nil || strings.TrimSpace(*cancellationReason) == "" {
			return nil, domain.ErrCancellationReasonRequired
		}
	}

	// Fetch current order to validate transition.
	current, err := s.orders.OrderByIDForShopOwner(ctx, ownerID, orderID)
	if err != nil {
		return nil, err
	}

	if !isValidTransition(current.Status, newStatus) {
		return nil, domain.ErrInvalidStatusTransition
	}

	// Undo of a cancellation requires re-decrementing stock and clearing the reason.
	var order *domain.Order
	if current.Status == "cancelled" && newStatus == "pending" {
		order, err = s.orders.RestoreCancelledOrder(ctx, ownerID, orderID)
	} else {
		order, err = s.orders.UpdateOrderStatusForShopOwner(ctx, ownerID, orderID, newStatus, cancellationReason)
	}
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}

	// The delivered event is the one worth optimising ads against under cash
	// on delivery: it represents a parcel the buyer actually accepted and paid
	// for, not merely an order they placed.
	if newStatus == domain.Delivered {
		s.publish(ctx, order, "OrderDelivered")
	}
	return order, nil
}

// ShipOrder records courier + tracking on an order. From "confirmed" it
// performs the confirmed->shipped transition and stores the shipment in one
// step; from "shipped" it just updates the tracking details (e.g. the seller
// entered the consignment ID after handing over the parcel). A courier name
// is required so the buyer-facing tracking view always has something to show.
func (s *OrderService) ShipOrder(ctx context.Context, ownerID, orderID, courierName, trackingID string) (*domain.Order, error) {
	courierName = strings.TrimSpace(courierName)
	trackingID = strings.TrimSpace(trackingID)
	if courierName == "" {
		return nil, domain.ErrCourierNameRequired
	}

	current, err := s.orders.OrderByIDForShopOwner(ctx, ownerID, orderID)
	if err != nil {
		return nil, err
	}

	var markShipped bool
	switch current.Status {
	case domain.Confirmed:
		markShipped = true
	case domain.Shipped:
		markShipped = false
	default:
		return nil, domain.ErrInvalidStatusTransition
	}

	order, err := s.orders.SetShipment(ctx, ownerID, orderID, courierName, trackingID, markShipped)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// BuyerCancelOrder lets the buyer cancel their own pending order.
// Verified by matching customerPhone. A cancellation reason is required.
func (s *OrderService) BuyerCancelOrder(ctx context.Context, slug, orderID, customerPhone, cancellationReason string) (*domain.Order, error) {
	if strings.TrimSpace(cancellationReason) == "" {
		return nil, domain.ErrCancellationReasonRequired
	}

	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	customerPhone = normalizePhone(customerPhone)
	order, err := s.orders.CancelOrderByBuyer(ctx, shop.ID, orderID, customerPhone, cancellationReason)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// MarkAdvanceReceived sets advance_payment_received to received. Sellers
// pass false to undo a premature confirmation while the order is still
// pending.
func (s *OrderService) MarkAdvanceReceived(ctx context.Context, ownerID, orderID string, received bool) (*domain.Order, error) {
	order, err := s.orders.MarkAdvanceReceived(ctx, ownerID, orderID, received)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// SubmitAdvanceProof persists buyer-submitted advance-payment proof on a
// still-pending order. The buyer authenticates via their phone number plus
// the order ID. Verifies the chosen method belongs to the shop and is active.
func (s *OrderService) SubmitAdvanceProof(ctx context.Context, slug, orderID string, in SubmitAdvanceProofInput) (*domain.Order, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	method, err := s.methods.Get(ctx, in.PaymentMethodID)
	if err != nil {
		return nil, err
	}
	if method.ShopID != shop.ID || !method.IsActive {
		return nil, domain.ErrPaymentMethodNotInShop
	}

	phone := normalizePhone(in.CustomerPhone)
	order, err := s.orders.SubmitAdvanceProof(
		ctx, shop.ID, orderID, phone, in.PaymentMethodID,
		strings.TrimSpace(in.TxnRef), strings.TrimSpace(in.Receipt),
	)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// BuyerEditOrder lets the buyer change delivery address/note on a still-pending
// order before the seller has confirmed.
func (s *OrderService) BuyerEditOrder(ctx context.Context, slug, orderID string, in BuyerEditOrderInput) (*domain.Order, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	phone := normalizePhone(in.CustomerPhone)
	address := strings.TrimSpace(in.DeliveryAddress)

	order, err := s.orders.UpdateBuyerEditableFields(ctx, shop.ID, orderID, phone, repository.BuyerEditableFields{
		DeliveryAddress:  address,
		DeliveryDivision: strings.TrimSpace(in.DeliveryDivision),
		DeliveryDistrict: strings.TrimSpace(in.DeliveryDistrict),
		Note:             strings.TrimSpace(in.Note),
	})
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

// LookupForCustomer returns an order for customer-facing lookup.
// Uses constant-time phone comparison to prevent timing attacks.
func (s *OrderService) LookupForCustomer(ctx context.Context, slug, orderID, customerPhone string) (*domain.Order, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	phone := normalizePhone(customerPhone)
	order, err := s.orders.FindByIDAndPhone(ctx, shop.ID, orderID, phone)
	if err != nil {
		return nil, err
	}
	// Constant-time comparison of the phone to prevent timing side-channel.
	if subtle.ConstantTimeCompare([]byte(order.CustomerPhone), []byte(phone)) != 1 {
		return nil, domain.ErrOrderNotFound
	}

	if err := s.orders.LoadItems(ctx, order); err != nil {
		return nil, err
	}
	return order, nil
}

func isValidTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

// paginationDefaults parses page/size strings into limit and offset with sane defaults.
func paginationDefaults(page, size string) (int, int) {
	p, err := strconv.Atoi(page)
	if err != nil || p < 1 {
		p = 1
	}
	s, err := strconv.Atoi(size)
	if err != nil || s < 1 {
		s = 10
	}
	return s, (p - 1) * s
}

// normalizePhone strips spaces, dashes, and leading +880/880 to get a consistent 01XXXXXXXXX form.
func normalizePhone(phone string) string {
	phone = strings.TrimSpace(phone)
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	if strings.HasPrefix(phone, "+880") {
		phone = "0" + phone[4:]
	} else if strings.HasPrefix(phone, "880") {
		phone = "0" + phone[3:]
	}
	return phone
}
