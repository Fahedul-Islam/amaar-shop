package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/meta"
)

// --- Mocks ---

type mockMetaRepo struct {
	settings map[string]*domain.MetaSettings
	events   []domain.MetaEvent
	sent     []string
	failed   map[string]struct {
		msg       string
		retryable bool
	}
}

func newMockMetaRepo() *mockMetaRepo {
	return &mockMetaRepo{
		settings: map[string]*domain.MetaSettings{},
		failed: map[string]struct {
			msg       string
			retryable bool
		}{},
	}
}

func (m *mockMetaRepo) GetSettings(_ context.Context, shopID string) (*domain.MetaSettings, error) {
	if s, ok := m.settings[shopID]; ok {
		return s, nil
	}
	return &domain.MetaSettings{ShopID: shopID, TrackDelivered: true}, nil
}
func (m *mockMetaRepo) UpsertSettings(_ context.Context, s *domain.MetaSettings) error {
	m.settings[s.ShopID] = s
	return nil
}
func (m *mockMetaRepo) EnqueueEvent(_ context.Context, e *domain.MetaEvent) error {
	// Mirror the DB's unique (shop_id, event_id) constraint.
	for _, existing := range m.events {
		if existing.ShopID == e.ShopID && existing.EventID == e.EventID {
			return nil
		}
	}
	e.ID = e.EventID
	m.events = append(m.events, *e)
	return nil
}
func (m *mockMetaRepo) ClaimPending(_ context.Context, limit int) ([]domain.MetaEvent, error) {
	return m.events, nil
}
func (m *mockMetaRepo) MarkSent(_ context.Context, id string) error {
	m.sent = append(m.sent, id)
	return nil
}
func (m *mockMetaRepo) MarkFailed(_ context.Context, id, errMsg string, retryable bool, _ int) error {
	m.failed[id] = struct {
		msg       string
		retryable bool
	}{errMsg, retryable}
	return nil
}
func (m *mockMetaRepo) TrackingStats(context.Context, string, time.Time, time.Time) (*domain.TrackingStats, error) {
	return &domain.TrackingStats{}, nil
}
func (m *mockMetaRepo) RecentEvents(context.Context, string, int) ([]domain.MetaEvent, error) {
	return m.events, nil
}
func (m *mockMetaRepo) FunnelStats(context.Context, string, time.Time, time.Time) (*domain.FunnelStats, error) {
	return &domain.FunnelStats{}, nil
}

type fakeMetaSender struct {
	err   error
	calls []meta.Event
}

func (f *fakeMetaSender) Send(_ context.Context, _, _ string, e meta.Event) (meta.Result, error) {
	f.calls = append(f.calls, e)
	if f.err != nil {
		return meta.Result{}, f.err
	}
	return meta.Result{EventsReceived: 1}, nil
}

// dispatcherFixture wires a dispatcher over a seeded order.
func dispatcherFixture(t *testing.T, sendErr error) (*MetaDispatcher, *mockMetaRepo, *fakeMetaSender, string) {
	t.Helper()
	orderSvc, shopRepo, deliveryRepo, prodRepo, orderRepo := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	p := seedProduct(t, prodRepo, shop.ID, "X", "500.00", 10)
	order, err := orderSvc.PlaceOrder(context.Background(), "my-shop", PlaceOrderInput{
		CustomerName: "Karim Rahman", CustomerPhone: "01712345678",
		DeliveryAddress: "House 1", DeliveryDivision: "Dhaka", DeliveryDistrict: "Dhaka",
		Items: []OrderItemInput{{ProductID: p.ID, Quantity: 1}},
	})
	if err != nil {
		t.Fatalf("place order: %v", err)
	}

	metaRepo := newMockMetaRepo()
	metaRepo.settings[shop.ID] = &domain.MetaSettings{
		ShopID: shop.ID, PixelID: "PIX", AccessToken: "TOK",
		IsEnabled: true, TrackDelivered: true,
	}
	sender := &fakeMetaSender{err: sendErr}
	d := NewMetaDispatcher(metaRepo, orderRepo, sender, nil, time.Minute)

	svc := NewMetaService(shopRepo, orderRepo, metaRepo)
	if err := svc.PublishOrderEvent(context.Background(), order, meta.EventPurchase); err != nil {
		t.Fatalf("publish: %v", err)
	}
	return d, metaRepo, sender, order.ID
}

// --- Tests ---

func TestDispatcher_SendsQueuedEvent(t *testing.T) {
	d, repo, sender, orderID := dispatcherFixture(t, nil)
	d.dispatch()

	if len(sender.calls) != 1 {
		t.Fatalf("expected 1 send, got %d", len(sender.calls))
	}
	if len(repo.sent) != 1 {
		t.Errorf("event should be marked sent, got %v", repo.sent)
	}
	got := sender.calls[0]
	if got.Name != meta.EventPurchase {
		t.Errorf("event name = %q", got.Name)
	}
	if got.EventID != orderID+"-purchase" {
		t.Errorf("event_id = %q, want %s-purchase", got.EventID, orderID)
	}
	// Buyer identifiers must be rehydrated from the order, not the queue row.
	if got.User.Phone != "01712345678" {
		t.Errorf("phone not attached: %q", got.User.Phone)
	}
	if got.User.FirstName != "Karim" || got.User.LastName != "Rahman" {
		t.Errorf("name split wrong: %q / %q", got.User.FirstName, got.User.LastName)
	}
	if got.Currency != "BDT" {
		t.Errorf("currency = %q", got.Currency)
	}
}

func TestDispatcher_PermanentErrorIsNotRetried(t *testing.T) {
	d, repo, _, _ := dispatcherFixture(t, &meta.APIError{Message: "Invalid OAuth access token.", Retryable: false})
	d.dispatch()

	if len(repo.sent) != 0 {
		t.Error("event must not be marked sent on failure")
	}
	for id, f := range repo.failed {
		if f.retryable {
			t.Errorf("event %s marked retryable for a permanent error", id)
		}
		if f.msg != "Invalid OAuth access token." {
			t.Errorf("Meta's message should be preserved, got %q", f.msg)
		}
	}
	if len(repo.failed) != 1 {
		t.Errorf("expected 1 failure recorded, got %d", len(repo.failed))
	}
}

func TestDispatcher_TransientErrorIsRetryable(t *testing.T) {
	d, repo, _, _ := dispatcherFixture(t, &meta.APIError{Message: "Please retry", Retryable: true})
	d.dispatch()

	for id, f := range repo.failed {
		if !f.retryable {
			t.Errorf("event %s should stay retryable after a transient error", id)
		}
	}
}

func TestDispatcher_SkipsShopWithTrackingDisabled(t *testing.T) {
	d, repo, sender, _ := dispatcherFixture(t, nil)
	for _, s := range repo.settings {
		s.IsEnabled = false
	}
	d.dispatch()

	if len(sender.calls) != 0 {
		t.Error("must not send for a shop with tracking disabled")
	}
	if len(repo.failed) != 1 {
		t.Errorf("event should be parked, got %d failures", len(repo.failed))
	}
}

func TestPublishOrderEvent_SkipsWhenNotConfigured(t *testing.T) {
	_, shopRepo, deliveryRepo, prodRepo, orderRepo := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	_ = seedProduct(t, prodRepo, shop.ID, "X", "500.00", 10)

	metaRepo := newMockMetaRepo() // no settings → not configured
	svc := NewMetaService(shopRepo, orderRepo, metaRepo)

	err := svc.PublishOrderEvent(context.Background(), &domain.Order{
		ID: "o1", ShopID: shop.ID, SubtotalBDT: "500.00", CustomerPhone: "01712345678",
	}, meta.EventPurchase)
	if err != nil {
		t.Fatalf("unconfigured shop must be a no-op, got %v", err)
	}
	if len(metaRepo.events) != 0 {
		t.Errorf("no event should be queued for an unconfigured shop, got %d", len(metaRepo.events))
	}
}

func TestPublishOrderEvent_IdempotentPerOrderAndEvent(t *testing.T) {
	_, shopRepo, deliveryRepo, prodRepo, orderRepo := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	_ = seedProduct(t, prodRepo, shop.ID, "X", "500.00", 10)

	metaRepo := newMockMetaRepo()
	metaRepo.settings[shop.ID] = &domain.MetaSettings{
		ShopID: shop.ID, PixelID: "P", AccessToken: "T", IsEnabled: true, TrackDelivered: true,
	}
	svc := NewMetaService(shopRepo, orderRepo, metaRepo)
	order := &domain.Order{ID: "o1", ShopID: shop.ID, SubtotalBDT: "500.00", CustomerPhone: "01712345678"}

	// Firing the same conversion twice must not double-count in Meta.
	_ = svc.PublishOrderEvent(context.Background(), order, meta.EventPurchase)
	_ = svc.PublishOrderEvent(context.Background(), order, meta.EventPurchase)
	if len(metaRepo.events) != 1 {
		t.Errorf("expected 1 queued event, got %d", len(metaRepo.events))
	}

	// A different event kind on the same order is a separate conversion.
	_ = svc.PublishOrderEvent(context.Background(), order, meta.EventDelivered)
	if len(metaRepo.events) != 2 {
		t.Errorf("delivered event should queue separately, got %d", len(metaRepo.events))
	}
}

func TestPublishOrderEvent_RespectsTrackDeliveredToggle(t *testing.T) {
	_, shopRepo, deliveryRepo, prodRepo, orderRepo := newTestOrderService(t)
	shop := seedShopWithDelivery(t, shopRepo, deliveryRepo, "user-1", "my-shop")
	_ = seedProduct(t, prodRepo, shop.ID, "X", "500.00", 10)

	metaRepo := newMockMetaRepo()
	metaRepo.settings[shop.ID] = &domain.MetaSettings{
		ShopID: shop.ID, PixelID: "P", AccessToken: "T", IsEnabled: true, TrackDelivered: false,
	}
	svc := NewMetaService(shopRepo, orderRepo, metaRepo)
	order := &domain.Order{ID: "o1", ShopID: shop.ID, SubtotalBDT: "500.00"}

	_ = svc.PublishOrderEvent(context.Background(), order, meta.EventDelivered)
	if len(metaRepo.events) != 0 {
		t.Error("delivered event must be skipped when the toggle is off")
	}
	_ = svc.PublishOrderEvent(context.Background(), order, meta.EventPurchase)
	if len(metaRepo.events) != 1 {
		t.Error("purchase event should still fire")
	}
}

func TestSplitName(t *testing.T) {
	cases := []struct{ in, first, last string }{
		{"Karim Rahman", "Karim", "Rahman"},
		{"Karim", "Karim", ""}, // single name: no fabricated surname
		{"  Md Karim  Rahman ", "Md", "Rahman"},
		{"", "", ""},
	}
	for _, c := range cases {
		f, l := splitName(c.in)
		if f != c.first || l != c.last {
			t.Errorf("splitName(%q) = %q,%q want %q,%q", c.in, f, l, c.first, c.last)
		}
	}
}

var _ = errors.New // keep errors import if future cases need it
