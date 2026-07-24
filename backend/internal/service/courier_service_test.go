package service

import (
	"context"
	"errors"
	"testing"

	"github.com/fhedul/amaarshop/backend/internal/courier"
	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// --- Mocks ---

type mockCourierSettingsRepo struct {
	settings map[string]*domain.CourierSettings
}

func newMockCourierSettingsRepo() *mockCourierSettingsRepo {
	return &mockCourierSettingsRepo{settings: make(map[string]*domain.CourierSettings)}
}

func (m *mockCourierSettingsRepo) Get(_ context.Context, shopID string) (*domain.CourierSettings, error) {
	if s, ok := m.settings[shopID]; ok {
		cp := *s
		return &cp, nil
	}
	return &domain.CourierSettings{ShopID: shopID, Provider: "steadfast"}, nil
}

func (m *mockCourierSettingsRepo) Upsert(_ context.Context, s *domain.CourierSettings) error {
	cp := *s
	m.settings[s.ShopID] = &cp
	return nil
}

type fakeCourierClient struct {
	lastReq courier.ConsignmentRequest
	resp    courier.Consignment
	err     error
}

func (f *fakeCourierClient) CreateConsignment(_ context.Context, _, _ string, in courier.ConsignmentRequest) (courier.Consignment, error) {
	f.lastReq = in
	if f.err != nil {
		return courier.Consignment{}, f.err
	}
	return f.resp, nil
}

// seedConfirmedOrder places an order through the order service and marks it
// confirmed, returning a wired CourierService that shares the same repos.
func seedConfirmedOrder(t *testing.T) (*CourierService, *mockCourierSettingsRepo, *fakeCourierClient, string, string) {
	t.Helper()
	orderSvc, shopRepo, deliveryRepo, prodRepo, orderRepo := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, err := orderSvc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Karim", CustomerPhone: "01712-345678",
		DeliveryAddress: "12 Road", DeliveryDivision: "Dhaka", DeliveryDistrict: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("place order: %v", err)
	}
	orderRepo.orders[order.ID].Status = "confirmed"

	courierRepo := newMockCourierSettingsRepo()
	client := &fakeCourierClient{}
	svc := NewCourierService(shopRepo, orderRepo, courierRepo, client)
	return svc, courierRepo, client, order.ID, shop.ID
}

// --- Tests ---

func TestBookCourier_Success(t *testing.T) {
	svc, courierRepo, client, orderID, shopID := seedConfirmedOrder(t)
	courierRepo.settings[shopID] = &domain.CourierSettings{
		ShopID: shopID, Provider: "steadfast", APIKey: "k", SecretKey: "s", IsEnabled: true,
	}
	client.resp = courier.Consignment{ConsignmentID: 42, TrackingCode: "TRK123", Status: "in_review"}

	got, err := svc.BookCourier(context.Background(), "user-1", orderID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != "shipped" {
		t.Errorf("expected shipped, got %q", got.Status)
	}
	if got.CourierName != "steadfast" || got.TrackingID != "TRK123" {
		t.Errorf("shipment not recorded: %q / %q", got.CourierName, got.TrackingID)
	}
	// COD = subtotal(100) + Dhaka delivery(60), no advance → 160.
	if client.lastReq.CODAmount != 160 {
		t.Errorf("expected COD 160, got %v", client.lastReq.CODAmount)
	}
	// Phone normalised to 11-digit local form.
	if client.lastReq.RecipientPhone != "01712345678" {
		t.Errorf("phone not sanitised: %q", client.lastReq.RecipientPhone)
	}
	if client.lastReq.Invoice != orderID {
		t.Errorf("invoice should be the order id, got %q", client.lastReq.Invoice)
	}
}

func TestBookCourier_NotConfigured(t *testing.T) {
	svc, courierRepo, _, orderID, shopID := seedConfirmedOrder(t)
	// Credentials present but disabled.
	courierRepo.settings[shopID] = &domain.CourierSettings{
		ShopID: shopID, APIKey: "k", SecretKey: "s", IsEnabled: false,
	}
	_, err := svc.BookCourier(context.Background(), "user-1", orderID)
	if err != domain.ErrCourierNotConfigured {
		t.Errorf("expected ErrCourierNotConfigured, got %v", err)
	}
}

func TestBookCourier_NotConfirmed(t *testing.T) {
	svc, courierRepo, _, orderID, shopID := seedConfirmedOrder(t)
	courierRepo.settings[shopID] = &domain.CourierSettings{
		ShopID: shopID, APIKey: "k", SecretKey: "s", IsEnabled: true,
	}
	// Regress the order back to pending — can't ship an unconfirmed order.
	svcOrders := svc.orders.(*mockOrderRepo)
	svcOrders.orders[orderID].Status = "pending"

	_, err := svc.BookCourier(context.Background(), "user-1", orderID)
	if err != domain.ErrInvalidStatusTransition {
		t.Errorf("expected ErrInvalidStatusTransition, got %v", err)
	}
}

func TestBookCourier_APIErrorPropagates(t *testing.T) {
	svc, courierRepo, client, orderID, shopID := seedConfirmedOrder(t)
	courierRepo.settings[shopID] = &domain.CourierSettings{
		ShopID: shopID, APIKey: "k", SecretKey: "s", IsEnabled: true,
	}
	client.err = &courier.APIError{Message: "recipient_phone is invalid"}

	_, err := svc.BookCourier(context.Background(), "user-1", orderID)
	var apiErr *courier.APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *courier.APIError, got %v", err)
	}
	if apiErr.Message != "recipient_phone is invalid" {
		t.Errorf("message not preserved: %q", apiErr.Message)
	}
}

func TestUpdateSettings_BlankKeysKeepExisting(t *testing.T) {
	svc, courierRepo, _, _, shopID := seedConfirmedOrder(t)
	courierRepo.settings[shopID] = &domain.CourierSettings{
		ShopID: shopID, Provider: "steadfast", APIKey: "old-key", SecretKey: "old-secret", IsEnabled: true,
	}

	// Toggle enabled off, sending blank keys — the stored secrets must survive.
	_, err := svc.UpdateSettings(context.Background(), "user-1", "", "", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := courierRepo.settings[shopID]
	if got.APIKey != "old-key" || got.SecretKey != "old-secret" {
		t.Errorf("blank keys clobbered stored secrets: %q / %q", got.APIKey, got.SecretKey)
	}
	if got.IsEnabled {
		t.Errorf("expected disabled after update")
	}
}
