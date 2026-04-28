package service

import (
	"context"
	"crypto/subtle"
	"fmt"
	"strconv"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// PlaceOrderInput carries the validated customer submission from the handler.
type PlaceOrderInput struct {
	CustomerName    string
	CustomerPhone   string
	DeliveryAddress string
	DeliveryArea    string
	Note            string
	Items           []OrderItemInput
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

// OrderService orchestrates order placement: price look-up, delivery charge
// calculation, COD/advance-payment checks, and transactional stock decrement.
type OrderService struct {
	shops    repository.ShopRepository
	delivery repository.DeliverySettingsRepository
	products repository.ProductRepository
	orders   repository.OrderRepository
}

func NewOrderService(
	shops repository.ShopRepository,
	delivery repository.DeliverySettingsRepository,
	products repository.ProductRepository,
	orders repository.OrderRepository,
) *OrderService {
	return &OrderService{
		shops:    shops,
		delivery: delivery,
		products: products,
		orders:   orders,
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

	// Validate delivery area.
	areaValid := false
	for _, a := range ds.DeliveryAreas {
		if a == in.DeliveryArea {
			areaValid = true
			break
		}
	}
	if !areaValid {
		return nil, domain.ErrInvalidDeliveryArea
	}

	// Build order items by looking up each product's current price and snapshotting it.
	var subtotal float64
	items := make([]domain.OrderItem, 0, len(in.Items))
	for _, item := range in.Items {
		p, err := s.products.FindByID(ctx, item.ProductID, shop.ID)
		if err != nil {
			return nil, err
		}
		if !p.IsActive || p.IsArchived {
			return nil, domain.ErrProductNotFound
		}
		if p.Stock < item.Quantity {
			return nil, domain.ErrInsufficientStock
		}

		unitPrice, _ := strconv.ParseFloat(p.PriceBDT, 64)
		lineTotal := unitPrice * float64(item.Quantity)
		subtotal += lineTotal

		items = append(items, domain.OrderItem{
			ProductID:            p.ID,
			ProductNameSnapshot:  p.Name,
			UnitPriceSnapshotBDT: p.PriceBDT,
			Quantity:             item.Quantity,
			LineTotalBDT:         fmt.Sprintf("%.2f", lineTotal),
		})
	}

	// Compute delivery charge: free if threshold is set and subtotal exceeds it.
	deliveryCharge, _ := strconv.ParseFloat(ds.DeliveryCharge, 64)
	if ds.FreeDeliveryThreshold != nil {
		threshold, _ := strconv.ParseFloat(*ds.FreeDeliveryThreshold, 64)
		if threshold > 0 && subtotal >= threshold {
			deliveryCharge = 0
		}
	}

	total := subtotal + deliveryCharge

	order := &domain.Order{
		ShopID:                 shop.ID,
		CustomerName:           in.CustomerName,
		CustomerPhone:          normalizePhone(in.CustomerPhone),
		DeliveryAddress:        in.DeliveryAddress,
		DeliveryArea:           in.DeliveryArea,
		Note:                   in.Note,
		SubtotalBDT:            fmt.Sprintf("%.2f", subtotal),
		DeliveryChargeBDT:      fmt.Sprintf("%.2f", deliveryCharge),
		TotalBDT:               fmt.Sprintf("%.2f", total),
		AdvancePaymentRequired: ds.AdvancePaymentRequired,
		Items:                  items,
	}

	if err := s.orders.PlaceOrder(ctx, order); err != nil {
		return nil, err
	}

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

// MarkAdvanceReceived marks an order's advance payment as received.
func (s *OrderService) MarkAdvanceReceived(ctx context.Context, ownerID, orderID string) (*domain.Order, error) {
	order, err := s.orders.MarkAdvanceReceived(ctx, ownerID, orderID)
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
