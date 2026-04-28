package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// --- Mock order repository ---

type mockOrderRepo struct {
	orders map[string]*domain.Order
	items  map[string][]domain.OrderItem // orderID -> items
	nextID int
}

func newMockOrderRepo() *mockOrderRepo {
	return &mockOrderRepo{
		orders: make(map[string]*domain.Order),
		items:  make(map[string][]domain.OrderItem),
	}
}

func (m *mockOrderRepo) PlaceOrder(_ context.Context, order *domain.Order) error {
	m.nextID++
	order.ID = fmt.Sprintf("order-%d", m.nextID)
	order.Status = "pending"
	for i := range order.Items {
		order.Items[i].ID = fmt.Sprintf("item-%d-%d", m.nextID, i)
		order.Items[i].OrderID = order.ID
	}
	stored := *order
	m.orders[order.ID] = &stored
	m.items[order.ID] = append([]domain.OrderItem{}, order.Items...)
	return nil
}

func (m *mockOrderRepo) OrderListByShopOwner(_ context.Context, ownerUserID string, status, phone string, limit, offset int) ([]*domain.Order, error) {
	var out []*domain.Order
	for _, o := range m.orders {
		if status != "" && o.Status != status {
			continue
		}
		if phone != "" && o.CustomerPhone != phone {
			continue
		}
		out = append(out, o)
	}
	return out, nil
}

func (m *mockOrderRepo) OrderByIDForShopOwner(_ context.Context, ownerUserID, orderID string) (*domain.Order, error) {
	o, ok := m.orders[orderID]
	if !ok {
		return nil, domain.ErrOrderNotFound
	}
	return o, nil
}

func (m *mockOrderRepo) UpdateOrderStatusForShopOwner(_ context.Context, ownerUserID, orderID, status string, cancelledReason *string) (*domain.Order, error) {
	o, ok := m.orders[orderID]
	if !ok {
		return nil, domain.ErrOrderNotFound
	}
	o.Status = status
	o.CancelledReason = cancelledReason
	return o, nil
}

func (m *mockOrderRepo) RestoreCancelledOrder(_ context.Context, ownerUserID, orderID string) (*domain.Order, error) {
	o, ok := m.orders[orderID]
	if !ok {
		return nil, domain.ErrOrderNotFound
	}
	if o.Status != "cancelled" {
		return nil, domain.ErrOrderNotFound
	}
	o.Status = "pending"
	o.CancelledReason = nil
	return o, nil
}

func (m *mockOrderRepo) CancelOrderByBuyer(_ context.Context, shopID, orderID, customerPhone, cancelledReason string) (*domain.Order, error) {
	o, ok := m.orders[orderID]
	if !ok {
		return nil, domain.ErrOrderNotFound
	}
	if o.Status != "pending" {
		return nil, domain.ErrOrderNotFound
	}
	if o.CustomerPhone != customerPhone {
		return nil, domain.ErrOrderNotFound
	}
	o.Status = "cancelled"
	o.CancelledReason = &cancelledReason
	return o, nil
}

func (m *mockOrderRepo) MarkAdvanceReceived(_ context.Context, ownerUserID, orderID string) (*domain.Order, error) {
	o, ok := m.orders[orderID]
	if !ok {
		return nil, domain.ErrOrderNotFound
	}
	o.AdvancePaymentReceived = true
	return o, nil
}

func (m *mockOrderRepo) FindByIDAndPhone(_ context.Context, shopID, orderID, customerPhone string) (*domain.Order, error) {
	o, ok := m.orders[orderID]
	if !ok {
		return nil, domain.ErrOrderNotFound
	}
	if o.CustomerPhone != customerPhone {
		return nil, domain.ErrOrderNotFound
	}
	return o, nil
}

func (m *mockOrderRepo) LoadItems(_ context.Context, orders ...*domain.Order) error {
	for _, o := range orders {
		o.Items = m.items[o.ID]
		if o.Items == nil {
			o.Items = []domain.OrderItem{}
		}
	}
	return nil
}

// --- Test helpers ---

func newTestOrderService(t *testing.T) (*OrderService, *mockShopRepo, *mockDeliveryRepo, *mockProductRepo, *mockOrderRepo) {
	t.Helper()
	shopRepo := newMockShopRepo()
	deliveryRepo := newMockDeliveryRepo()
	prodRepo := newMockProductRepo(shopRepo)
	orderRepo := newMockOrderRepo()
	svc := NewOrderService(shopRepo, deliveryRepo, prodRepo, orderRepo)
	return svc, shopRepo, deliveryRepo, prodRepo, orderRepo
}

func seedShopWithDelivery(t *testing.T, shopRepo *mockShopRepo, deliveryRepo *mockDeliveryRepo, ownerID, slug string) *domain.Shop {
	t.Helper()
	shop := mustCreateShop(t, shopRepo, ownerID, slug)
	threshold := "1000.00"
	deliveryRepo.settings[shop.ID] = &domain.DeliverySettings{
		ShopID:               shop.ID,
		CODEnabled:           true,
		DeliveryCharge:       "60.00",
		FreeDeliveryThreshold: &threshold,
		DeliveryAreas:        []string{"Dhaka", "Chittagong"},
	}
	return shop
}

func seedProduct(t *testing.T, prodRepo *mockProductRepo, shopID, name, price string, stock int) *domain.Product {
	t.Helper()
	prodRepo.nextID++
	p := &domain.Product{
		ID:       fmt.Sprintf("prod-%d", prodRepo.nextID),
		ShopID:   shopID,
		Name:     name,
		PriceBDT: price,
		Stock:    stock,
		IsActive: true,
	}
	prodRepo.products[p.ID] = p
	return p
}

// --- Tests: PlaceOrder ---

func TestPlaceOrder_Success(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "T-Shirt", "450.00", 10)

	order, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test User",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "123 Street",
		DeliveryArea:    "Dhaka",
		Items: []OrderItemInput{
			{ProductID: p.ID, Quantity: 2},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if order.Status != "pending" {
		t.Errorf("expected status pending, got %q", order.Status)
	}
	if order.SubtotalBDT != "900.00" {
		t.Errorf("expected subtotal 900.00, got %q", order.SubtotalBDT)
	}
	if order.DeliveryChargeBDT != "60.00" {
		t.Errorf("expected delivery charge 60.00, got %q", order.DeliveryChargeBDT)
	}
	if order.TotalBDT != "960.00" {
		t.Errorf("expected total 960.00, got %q", order.TotalBDT)
	}
	if len(order.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(order.Items))
	}
	if order.Items[0].ProductNameSnapshot != "T-Shirt" {
		t.Errorf("expected snapshot name T-Shirt, got %q", order.Items[0].ProductNameSnapshot)
	}
	if order.Items[0].UnitPriceSnapshotBDT != "450.00" {
		t.Errorf("expected snapshot price 450.00, got %q", order.Items[0].UnitPriceSnapshotBDT)
	}
}

func TestPlaceOrder_FreeDeliveryAboveThreshold(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "Expensive Item", "1200.00", 5)

	order, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test User",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "123 Street",
		DeliveryArea:    "Dhaka",
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if order.DeliveryChargeBDT != "0.00" {
		t.Errorf("expected free delivery, got charge %q", order.DeliveryChargeBDT)
	}
	if order.TotalBDT != "1200.00" {
		t.Errorf("expected total 1200.00, got %q", order.TotalBDT)
	}
}

func TestPlaceOrder_TotalCalculation_MultipleItems(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p1 := seedProduct(t, prodRepo, shop.ID, "Item A", "100.00", 10)
	p2 := seedProduct(t, prodRepo, shop.ID, "Item B", "250.50", 5)

	order, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test User",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "123 Street",
		DeliveryArea:    "Dhaka",
		Items: []OrderItemInput{
			{ProductID: p1.ID, Quantity: 3}, // 300.00
			{ProductID: p2.ID, Quantity: 2}, // 501.00
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Subtotal: 300 + 501 = 801, under 1000 threshold so delivery = 60
	if order.SubtotalBDT != "801.00" {
		t.Errorf("expected subtotal 801.00, got %q", order.SubtotalBDT)
	}
	if order.DeliveryChargeBDT != "60.00" {
		t.Errorf("expected delivery 60.00, got %q", order.DeliveryChargeBDT)
	}
	if order.TotalBDT != "861.00" {
		t.Errorf("expected total 861.00, got %q", order.TotalBDT)
	}
}

func TestPlaceOrder_CODDisabled(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	deliveryRepo.settings[shop.ID].CODEnabled = false
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	_, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "Addr",
		DeliveryArea:    "Dhaka",
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != domain.ErrCheckoutDisabled {
		t.Errorf("expected ErrCheckoutDisabled, got %v", err)
	}
}

func TestPlaceOrder_SuspendedShop(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	shop.IsSuspended = true
	shopRepo.shops[shop.ID] = shop
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	_, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "Addr",
		DeliveryArea:    "Dhaka",
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != domain.ErrShopNotFound {
		t.Errorf("expected ErrShopNotFound, got %v", err)
	}
}

func TestPlaceOrder_InvalidDeliveryArea(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	_, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "Addr",
		DeliveryArea:    "Rajshahi", // not in delivery areas
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != domain.ErrInvalidDeliveryArea {
		t.Errorf("expected ErrInvalidDeliveryArea, got %v", err)
	}
}

func TestPlaceOrder_InsufficientStock(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 2)

	_, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "Addr",
		DeliveryArea:    "Dhaka",
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 5}},
	})
	if err != domain.ErrInsufficientStock {
		t.Errorf("expected ErrInsufficientStock, got %v", err)
	}
}

func TestPlaceOrder_InactiveProduct(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)
	p.IsActive = false

	_, err := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName:    "Test",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "Addr",
		DeliveryArea:    "Dhaka",
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != domain.ErrProductNotFound {
		t.Errorf("expected ErrProductNotFound, got %v", err)
	}
}

func TestPlaceOrder_CrossShopProduct(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "shop-one")
	shop2 := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-2", "shop-two")
	p := seedProduct(t, prodRepo, shop2.ID, "Other Shop Product", "100.00", 10)

	_, err := svc.PlaceOrder(context.Background(), "shop-one", PlaceOrderInput{
		CustomerName:    "Test",
		CustomerPhone:   "01712345678",
		DeliveryAddress: "Addr",
		DeliveryArea:    "Dhaka",
		Items:           []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != domain.ErrProductNotFound {
		t.Errorf("expected ErrProductNotFound for cross-shop product, got %v", err)
	}
}

// --- Tests: status transitions ---

func TestUpdateOrderStatus_ValidTransitions(t *testing.T) {
	tests := []struct {
		from, to string
		valid    bool
	}{
		{"pending", "confirmed", true},
		{"pending", "cancelled", true},
		{"confirmed", "shipped", true},
		{"confirmed", "cancelled", true},
		{"shipped", "delivered", true},
		{"shipped", "returned", true},
		// Backward (undo) transitions.
		{"confirmed", "pending", true},
		{"shipped", "confirmed", true},
		{"delivered", "shipped", true},
		{"returned", "shipped", true},
		{"cancelled", "pending", true},
		// Still invalid: skips and forward-from-terminal.
		{"pending", "shipped", false},
		{"pending", "delivered", false},
		{"confirmed", "delivered", false},
		{"delivered", "cancelled", false},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s->%s", tt.from, tt.to), func(t *testing.T) {
			svc, shopRepo, deliveryRepo, prodRepo, orderRepo := newTestOrderService(t)
			shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
			p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

			order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
				CustomerName: "Test", CustomerPhone: "01712345678",
				DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
				Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
			})

			// Set order to desired starting status.
			orderRepo.orders[order.ID].Status = tt.from

			var reason *string
			if tt.to == "cancelled" {
				r := "test cancel"
				reason = &r
			}

			_, err := svc.UpdateOrderStatus(context.Background(), "user-1", order.ID, tt.to, reason)
			if tt.valid && err != nil {
				t.Errorf("expected valid transition %s->%s, got error: %v", tt.from, tt.to, err)
			}
			if !tt.valid && err != domain.ErrInvalidStatusTransition {
				t.Errorf("expected ErrInvalidStatusTransition for %s->%s, got: %v", tt.from, tt.to, err)
			}
		})
	}
}

func TestUpdateOrderStatus_CancelRequiresReason(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Test", CustomerPhone: "01712345678",
		DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})

	// No reason.
	_, err := svc.UpdateOrderStatus(context.Background(), "user-1", order.ID, "cancelled", nil)
	if err != domain.ErrCancellationReasonRequired {
		t.Errorf("expected ErrCancellationReasonRequired, got %v", err)
	}

	// Empty reason.
	empty := ""
	_, err = svc.UpdateOrderStatus(context.Background(), "user-1", order.ID, "cancelled", &empty)
	if err != domain.ErrCancellationReasonRequired {
		t.Errorf("expected ErrCancellationReasonRequired for empty reason, got %v", err)
	}
}

// --- Tests: MarkAdvanceReceived ---

func TestMarkAdvanceReceived_Success(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	deliveryRepo.settings[shop.ID].AdvancePaymentRequired = true
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Test", CustomerPhone: "01712345678",
		DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})

	updated, err := svc.MarkAdvanceReceived(context.Background(), "user-1", order.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !updated.AdvancePaymentReceived {
		t.Error("expected AdvancePaymentReceived to be true")
	}
}

// --- Tests: LookupForCustomer ---

func TestLookupForCustomer_Success(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Test", CustomerPhone: "01712345678",
		DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})

	found, err := svc.LookupForCustomer(context.Background(), "my-shop", order.ID, "01712345678")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if found.ID != order.ID {
		t.Errorf("expected order %s, got %s", order.ID, found.ID)
	}
}

func TestLookupForCustomer_WrongPhone(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Test", CustomerPhone: "01712345678",
		DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})

	_, err := svc.LookupForCustomer(context.Background(), "my-shop", order.ID, "01799999999")
	if err != domain.ErrOrderNotFound {
		t.Errorf("expected ErrOrderNotFound for wrong phone, got %v", err)
	}
}

// --- Tests: BuyerCancelOrder ---

func TestBuyerCancelOrder_Success(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Test", CustomerPhone: "01712345678",
		DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})

	cancelled, err := svc.BuyerCancelOrder(context.Background(), "my-shop", order.ID, "01712345678", "Changed my mind")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cancelled.Status != "cancelled" {
		t.Errorf("expected cancelled, got %q", cancelled.Status)
	}
}

func TestBuyerCancelOrder_EmptyReason(t *testing.T) {
	svc, shopRepo, deliveryRepo, prodRepo, _ := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "100.00", 10)

	order, _ := svc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Test", CustomerPhone: "01712345678",
		DeliveryAddress: "Addr", DeliveryArea: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})

	_, err := svc.BuyerCancelOrder(context.Background(), "my-shop", order.ID, "01712345678", "")
	if err != domain.ErrCancellationReasonRequired {
		t.Errorf("expected ErrCancellationReasonRequired, got %v", err)
	}
}

// --- Tests: phone normalization ---

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		input, expected string
	}{
		{"01712345678", "01712345678"},
		{"+8801712345678", "01712345678"},
		{"8801712345678", "01712345678"},
		{"017-1234-5678", "01712345678"},
		{"017 1234 5678", "01712345678"},
	}
	for _, tt := range tests {
		got := normalizePhone(tt.input)
		if got != tt.expected {
			t.Errorf("normalizePhone(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}
