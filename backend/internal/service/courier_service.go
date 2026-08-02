package service

import (
	"context"
	"strconv"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/courier"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// CourierClient is the seam over a courier provider's API (Steadfast today).
// The concrete client lives in internal/courier; tests inject a fake.
type CourierClient interface {
	CreateConsignment(ctx context.Context, apiKey, secretKey string, in courier.ConsignmentRequest) (courier.Consignment, error)
}

// CourierService owns per-shop courier credentials and one-click booking.
// Booking reuses the order repository's SetShipment so the manual and
// automatic paths converge on the same shipment record.
type CourierService struct {
	shops   repository.ShopRepository
	orders  repository.OrderShipmentRepository
	courier repository.CourierSettingsRepository
	client  CourierClient
}

func NewCourierService(
	shops repository.ShopRepository,
	orders repository.OrderShipmentRepository,
	courierRepo repository.CourierSettingsRepository,
	client CourierClient,
) *CourierService {
	return &CourierService{shops: shops, orders: orders, courier: courierRepo, client: client}
}

// GetSettings returns the authenticated shop's courier settings. Secrets are
// stripped by the handler before serialisation.
func (s *CourierService) GetSettings(ctx context.Context, ownerID string) (*domain.CourierSettings, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	return s.courier.Get(ctx, shop.ID)
}

// UpdateSettings upserts credentials. A blank key on an already-configured
// shop keeps the stored value, so the seller can toggle "enabled" or rotate one
// key without re-typing both secrets.
func (s *CourierService) UpdateSettings(ctx context.Context, ownerID, apiKey, secretKey string, enabled bool) (*domain.CourierSettings, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	existing, err := s.courier.Get(ctx, shop.ID)
	if err != nil {
		return nil, err
	}

	apiKey = strings.TrimSpace(apiKey)
	secretKey = strings.TrimSpace(secretKey)
	if apiKey == "" {
		apiKey = existing.APIKey
	}
	if secretKey == "" {
		secretKey = existing.SecretKey
	}

	next := &domain.CourierSettings{
		ShopID:    shop.ID,
		Provider:  "steadfast",
		APIKey:    apiKey,
		SecretKey: secretKey,
		IsEnabled: enabled,
	}
	if err := s.courier.Upsert(ctx, next); err != nil {
		return nil, err
	}
	return s.courier.Get(ctx, shop.ID)
}

// BookCourier creates a Steadfast consignment for a confirmed order and marks
// it shipped with the returned tracking code. The shop must own the order and
// have enabled, complete credentials.
func (s *CourierService) BookCourier(ctx context.Context, ownerID, orderID string) (*domain.Order, error) {
	order, err := s.orders.OrderByIDForShopOwner(ctx, ownerID, orderID)
	if err != nil {
		return nil, err
	}
	if order.Status != domain.Confirmed {
		return nil, domain.ErrInvalidStatusTransition
	}

	settings, err := s.courier.Get(ctx, order.ShopID)
	if err != nil {
		return nil, err
	}
	if !settings.IsEnabled || !settings.Configured() {
		return nil, domain.ErrCourierNotConfigured
	}

	cons, err := s.client.CreateConsignment(ctx, settings.APIKey, settings.SecretKey, courier.ConsignmentRequest{
		Invoice:          order.ID,
		RecipientName:    order.CustomerName,
		RecipientPhone:   sanitizeBDPhone(order.CustomerPhone),
		RecipientAddress: shipmentAddress(order),
		CODAmount:        codAmount(order),
		Note:             order.Note,
	})
	if err != nil {
		return nil, err // *courier.APIError bubbles up; the handler surfaces its message
	}

	updated, err := s.orders.SetShipment(ctx, ownerID, orderID, "steadfast", cons.TrackingCode, true)
	if err != nil {
		return nil, err
	}
	if err := s.orders.LoadItems(ctx, updated); err != nil {
		return nil, err
	}
	return updated, nil
}

// codAmount is the cash the rider collects on delivery: when an advance was
// required the delivery fee was prepaid, so only the subtotal is due; otherwise
// the full order total.
func codAmount(o *domain.Order) float64 {
	raw := o.TotalBDT
	if o.AdvancePaymentRequired {
		raw = o.SubtotalBDT
	}
	v, _ := strconv.ParseFloat(raw, 64)
	return v
}

// shipmentAddress builds a single-line delivery address for the courier.
func shipmentAddress(o *domain.Order) string {
	parts := []string{o.DeliveryAddress}
	if o.DeliveryDistrict != "" {
		parts = append(parts, o.DeliveryDistrict)
	}
	if o.DeliveryDivision != "" {
		parts = append(parts, o.DeliveryDivision)
	}
	return strings.Join(parts, ", ")
}

// sanitizeBDPhone reduces a stored phone to the 11-digit local form Steadfast
// expects (01XXXXXXXXX), converting a leading 880 country code if present.
func sanitizeBDPhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if len(digits) == 13 && strings.HasPrefix(digits, "880") {
		return "0" + digits[3:]
	}
	return digits
}
