package service

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// --- Mock repositories ---

type mockShopRepo struct {
	shops    map[string]*domain.Shop
	nextID   int
	onCreate func(*domain.Shop) // optional post-create hook used by tests to seed dependent state
}

func newMockShopRepo() *mockShopRepo {
	return &mockShopRepo{shops: make(map[string]*domain.Shop)}
}

func (m *mockShopRepo) Create(_ context.Context, shop *domain.Shop) error {
	for _, s := range m.shops {
		if s.OwnerUserID == shop.OwnerUserID {
			return domain.ErrShopAlreadyExists
		}
		if s.Slug == shop.Slug {
			return domain.ErrSlugTaken
		}
	}
	m.nextID++
	shop.ID = fmt.Sprintf("shop-%d", m.nextID)
	m.shops[shop.ID] = shop
	if m.onCreate != nil {
		m.onCreate(shop)
	}
	return nil
}

func (m *mockShopRepo) FindByID(_ context.Context, id string) (*domain.Shop, error) {
	s, ok := m.shops[id]
	if !ok {
		return nil, domain.ErrShopNotFound
	}
	return s, nil
}

func (m *mockShopRepo) FindBySlug(_ context.Context, slug string) (*domain.Shop, error) {
	for _, s := range m.shops {
		if s.Slug == slug {
			return s, nil
		}
	}
	return nil, domain.ErrShopNotFound
}

func (m *mockShopRepo) FindByOwnerID(_ context.Context, ownerUserID string) (*domain.Shop, error) {
	for _, s := range m.shops {
		if s.OwnerUserID == ownerUserID {
			return s, nil
		}
	}
	return nil, domain.ErrShopNotFound
}

func (m *mockShopRepo) Update(_ context.Context, shop *domain.Shop) error {
	if _, ok := m.shops[shop.ID]; !ok {
		return domain.ErrShopNotFound
	}
	m.shops[shop.ID] = shop
	return nil
}

func (m *mockShopRepo) IsSlugAvailable(_ context.Context, slug string) (bool, error) {
	for _, s := range m.shops {
		if s.Slug == slug {
			return false, nil
		}
	}
	return true, nil
}

type mockDeliveryRepo struct {
	settings map[string]*domain.DeliverySettings
}

func newMockDeliveryRepo() *mockDeliveryRepo {
	return &mockDeliveryRepo{settings: make(map[string]*domain.DeliverySettings)}
}

func (m *mockDeliveryRepo) Get(_ context.Context, shopID string) (*domain.DeliverySettings, error) {
	ds, ok := m.settings[shopID]
	if !ok {
		return nil, domain.ErrShopNotFound
	}
	return ds, nil
}

func (m *mockDeliveryRepo) Upsert(_ context.Context, ds *domain.DeliverySettings) error {
	m.settings[ds.ShopID] = ds
	return nil
}

type mockFileStorage struct {
	saved map[string]string // filename -> url
}

func newMockFileStorage() *mockFileStorage {
	return &mockFileStorage{saved: make(map[string]string)}
}

func (m *mockFileStorage) Save(_ io.Reader, prefix, filename string) (string, error) {
	url := "/uploads/" + prefix + "-test.png"
	m.saved[filename] = url
	return url, nil
}

type mockReviewRepo struct{}

func (m *mockReviewRepo) Create(_ context.Context, _ *domain.Review) error { return nil }
func (m *mockReviewRepo) FindByID(_ context.Context, _ string) (*domain.Review, error) {
	return nil, domain.ErrReviewNotFound
}
func (m *mockReviewRepo) ListByShop(_ context.Context, _ string, _, _ int) ([]*domain.Review, int, error) {
	return nil, 0, nil
}
func (m *mockReviewRepo) ListByProduct(_ context.Context, _ string, _, _ int) ([]*domain.Review, int, error) {
	return nil, 0, nil
}
func (m *mockReviewRepo) ShopRating(_ context.Context, _ string) (domain.ShopRating, error) {
	return domain.ShopRating{}, nil
}
func (m *mockReviewRepo) ProductRating(_ context.Context, _ string) (domain.ProductRating, error) {
	return domain.ProductRating{}, nil
}
func (m *mockReviewRepo) SetOwnerReply(_ context.Context, _, _, _ string) (*domain.Review, error) {
	return nil, domain.ErrReviewNotFound
}
func (m *mockReviewRepo) FindOrderItemForReview(_ context.Context, _ string) (repository.OrderItemReviewContext, error) {
	return repository.OrderItemReviewContext{}, nil
}

func newTestShopService() (*ShopService, *mockShopRepo, *mockDeliveryRepo) {
	shopRepo := newMockShopRepo()
	deliveryRepo := newMockDeliveryRepo()
	files := newMockFileStorage()
	svc := NewShopService(shopRepo, deliveryRepo, &mockReviewRepo{}, files)
	return svc, shopRepo, deliveryRepo
}

// --- Tests ---

func TestCreateShop_Success(t *testing.T) {
	svc, _, deliveryRepo := newTestShopService()

	shop, err := svc.CreateShop(context.Background(), "user-1", "My Shop", "my-shop", "desc", "+8801712345678")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if shop.Name != "My Shop" {
		t.Errorf("expected name 'My Shop', got %q", shop.Name)
	}
	if shop.Slug != "my-shop" {
		t.Errorf("expected slug 'my-shop', got %q", shop.Slug)
	}
	if shop.OwnerUserID != "user-1" {
		t.Errorf("expected owner user-1, got %q", shop.OwnerUserID)
	}

	// Verify default delivery settings were created
	ds, err := deliveryRepo.Get(context.Background(), shop.ID)
	if err != nil {
		t.Fatalf("delivery settings not created: %v", err)
	}
	if !ds.CODEnabled {
		t.Error("expected COD enabled by default")
	}
}

func TestCreateShop_DuplicateOwner(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, err := svc.CreateShop(context.Background(), "user-1", "Shop 1", "shop-one", "", "")
	if err != nil {
		t.Fatalf("first shop failed: %v", err)
	}

	_, err = svc.CreateShop(context.Background(), "user-1", "Shop 2", "shop-two", "", "")
	if err != domain.ErrShopAlreadyExists {
		t.Errorf("expected ErrShopAlreadyExists, got %v", err)
	}
}

func TestCreateShop_DuplicateSlug(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, err := svc.CreateShop(context.Background(), "user-1", "Shop 1", "my-shop", "", "")
	if err != nil {
		t.Fatalf("first shop failed: %v", err)
	}

	_, err = svc.CreateShop(context.Background(), "user-2", "Shop 2", "my-shop", "", "")
	if err != domain.ErrSlugTaken {
		t.Errorf("expected ErrSlugTaken, got %v", err)
	}
}

func TestGetMyShop_NotFound(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, err := svc.GetMyShop(context.Background(), "no-such-user")
	if err != domain.ErrShopNotFound {
		t.Errorf("expected ErrShopNotFound, got %v", err)
	}
}

func TestUpdateShop_Success(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Original", "my-shop", "old desc", "")

	shop, err := svc.UpdateShop(context.Background(), "user-1", "Updated", "new desc", "+880123")
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if shop.Name != "Updated" {
		t.Errorf("expected name 'Updated', got %q", shop.Name)
	}
	if shop.Description != "new desc" {
		t.Errorf("expected description 'new desc', got %q", shop.Description)
	}
}

func TestCheckSlug_Available(t *testing.T) {
	svc, _, _ := newTestShopService()

	avail, err := svc.CheckSlug(context.Background(), "fresh-slug")
	if err != nil {
		t.Fatalf("check slug failed: %v", err)
	}
	if !avail {
		t.Error("expected slug to be available")
	}
}

func TestCheckSlug_Taken(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Shop", "taken-slug", "", "")

	avail, err := svc.CheckSlug(context.Background(), "taken-slug")
	if err != nil {
		t.Fatalf("check slug failed: %v", err)
	}
	if avail {
		t.Error("expected slug to be taken")
	}
}

func TestUploadLogo_Success(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Shop", "my-shop", "", "")

	url, err := svc.UploadLogo(context.Background(), "user-1", strings.NewReader("fake-image"), "logo.png")
	if err != nil {
		t.Fatalf("upload logo failed: %v", err)
	}
	if url == "" {
		t.Error("expected non-empty URL")
	}

	// Verify shop's logo_url was updated
	shop, _ := svc.GetMyShop(context.Background(), "user-1")
	if shop.LogoURL != url {
		t.Errorf("expected logo_url %q, got %q", url, shop.LogoURL)
	}
}

func TestUpdateDeliverySettings_Success(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Shop", "my-shop", "", "")

	threshold := "500.00"
	ds := &domain.DeliverySettings{
		CODEnabled:            true,
		DeliveryCharge:        "60.00",
		FreeDeliveryThreshold: &threshold,
		DeliveryZones: []domain.DeliveryZone{
			{Division: "Dhaka", DeliveryCharge: "60.00"},
			{Division: "Chattogram", DeliveryCharge: "80.00"},
		},
	}

	result, err := svc.UpdateDeliverySettings(context.Background(), "user-1", ds)
	if err != nil {
		t.Fatalf("update delivery settings failed: %v", err)
	}
	if result.DeliveryCharge != "60.00" {
		t.Errorf("expected charge '60.00', got %q", result.DeliveryCharge)
	}
}

func TestUpdateDeliverySettings_InvalidCharge(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Shop", "my-shop", "", "")

	ds := &domain.DeliverySettings{
		CODEnabled:     true,
		DeliveryCharge: "-10.00",
		DeliveryZones: []domain.DeliveryZone{
			{Division: "Dhaka", DeliveryCharge: "60.00"},
		},
	}

	_, err := svc.UpdateDeliverySettings(context.Background(), "user-1", ds)
	if err != domain.ErrInvalidDeliveryCharge {
		t.Errorf("expected ErrInvalidDeliveryCharge, got %v", err)
	}
}

func TestUpdateDeliverySettings_ThresholdBelowCharge(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Shop", "my-shop", "", "")

	threshold := "50.00"
	ds := &domain.DeliverySettings{
		CODEnabled:            true,
		DeliveryCharge:        "60.00",
		FreeDeliveryThreshold: &threshold,
		DeliveryZones: []domain.DeliveryZone{
			{Division: "Dhaka", DeliveryCharge: "60.00"},
		},
	}

	_, err := svc.UpdateDeliverySettings(context.Background(), "user-1", ds)
	if err != domain.ErrInvalidThreshold {
		t.Errorf("expected ErrInvalidThreshold, got %v", err)
	}
}

func TestUpdateDeliverySettings_AllowsEmptyZones(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Shop", "my-shop", "", "")

	ds := &domain.DeliverySettings{
		CODEnabled:     true,
		DeliveryCharge: "60.00",
		DeliveryZones:  []domain.DeliveryZone{},
	}

	if _, err := svc.UpdateDeliverySettings(context.Background(), "user-1", ds); err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestGetPublicShop_Suspended(t *testing.T) {
	svc, shopRepo, _ := newTestShopService()

	shop, _ := svc.CreateShop(context.Background(), "user-1", "Shop", "my-shop", "", "")

	// Suspend the shop directly in the repo
	shop.IsSuspended = true
	shopRepo.shops[shop.ID] = shop

	_, err := svc.GetPublicShop(context.Background(), "my-shop")
	if err != domain.ErrShopNotFound {
		t.Errorf("expected ErrShopNotFound for suspended shop, got %v", err)
	}
}

func TestGetPublicShop_Success(t *testing.T) {
	svc, _, _ := newTestShopService()

	_, _ = svc.CreateShop(context.Background(), "user-1", "Public Shop", "public-shop", "hello", "")

	shop, err := svc.GetPublicShop(context.Background(), "public-shop")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if shop.Name != "Public Shop" {
		t.Errorf("expected name 'Public Shop', got %q", shop.Name)
	}
}
