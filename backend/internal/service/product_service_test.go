package service

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// --- Mock repositories ---

type mockCategoryRepo struct {
	categories map[string]*domain.Category
	nextID     int
}

func newMockCategoryRepo() *mockCategoryRepo {
	return &mockCategoryRepo{categories: make(map[string]*domain.Category)}
}

func (m *mockCategoryRepo) Create(_ context.Context, c *domain.Category) error {
	for _, existing := range m.categories {
		if existing.ShopID == c.ShopID && strings.EqualFold(existing.Name, c.Name) {
			return domain.ErrCategoryNameTaken
		}
	}
	m.nextID++
	c.ID = fmt.Sprintf("cat-%d", m.nextID)
	m.categories[c.ID] = c
	return nil
}

func (m *mockCategoryRepo) Update(_ context.Context, c *domain.Category) error {
	existing, ok := m.categories[c.ID]
	if !ok || existing.ShopID != c.ShopID {
		return domain.ErrCategoryNotFound
	}
	existing.Name = c.Name
	return nil
}

func (m *mockCategoryRepo) Delete(_ context.Context, id, shopID string) error {
	c, ok := m.categories[id]
	if !ok || c.ShopID != shopID {
		return domain.ErrCategoryNotFound
	}
	delete(m.categories, id)
	return nil
}

func (m *mockCategoryRepo) FindByID(_ context.Context, id, shopID string) (*domain.Category, error) {
	c, ok := m.categories[id]
	if !ok || c.ShopID != shopID {
		return nil, domain.ErrCategoryNotFound
	}
	return c, nil
}

func (m *mockCategoryRepo) ListByShop(_ context.Context, shopID string) ([]*domain.Category, error) {
	out := make([]*domain.Category, 0)
	for _, c := range m.categories {
		if c.ShopID == shopID {
			out = append(out, c)
		}
	}
	return out, nil
}

type mockProductRepo struct {
	products map[string]*domain.Product
	images   map[string][]*domain.ProductImage // productID -> images
	shops    *mockShopRepo                     // used only by ListPublicByShopSlug
	nextID   int
	imgID    int
}

func newMockProductRepo(shops *mockShopRepo) *mockProductRepo {
	return &mockProductRepo{
		products: make(map[string]*domain.Product),
		images:   make(map[string][]*domain.ProductImage),
		shops:    shops,
	}
}

func (m *mockProductRepo) Create(_ context.Context, p *domain.Product) error {
	m.nextID++
	p.ID = fmt.Sprintf("prod-%d", m.nextID)
	p.Images = []domain.ProductImage{}
	stored := *p
	m.products[p.ID] = &stored
	return nil
}

func (m *mockProductRepo) Update(_ context.Context, p *domain.Product) error {
	existing, ok := m.products[p.ID]
	if !ok || existing.ShopID != p.ShopID {
		return domain.ErrProductNotFound
	}
	existing.CategoryID = p.CategoryID
	existing.Name = p.Name
	existing.Description = p.Description
	existing.PriceBDT = p.PriceBDT
	existing.Stock = p.Stock
	existing.IsActive = p.IsActive
	return nil
}

func (m *mockProductRepo) Archive(_ context.Context, id, shopID string) error {
	p, ok := m.products[id]
	if !ok || p.ShopID != shopID {
		return domain.ErrProductNotFound
	}
	p.IsArchived = true
	return nil
}

func (m *mockProductRepo) Delete(_ context.Context, id, shopID string) error {
	p, ok := m.products[id]
	if !ok || p.ShopID != shopID {
		return domain.ErrProductNotFound
	}
	delete(m.products, id)
	delete(m.images, id)
	return nil
}

func (m *mockProductRepo) FindByID(_ context.Context, id, shopID string) (*domain.Product, error) {
	p, ok := m.products[id]
	if !ok || p.ShopID != shopID {
		return nil, domain.ErrProductNotFound
	}
	cp := *p
	cp.Images = make([]domain.ProductImage, 0, len(m.images[id]))
	for _, img := range m.images[id] {
		cp.Images = append(cp.Images, *img)
	}
	return &cp, nil
}

func (m *mockProductRepo) ListByShop(_ context.Context, shopID string, filter domain.ProductFilter) ([]*domain.Product, int, error) {
	out := make([]*domain.Product, 0)
	for _, p := range m.products {
		if p.ShopID != shopID {
			continue
		}
		if filter.IsActive != nil && p.IsActive != *filter.IsActive {
			continue
		}
		if filter.IsArchived != nil && p.IsArchived != *filter.IsArchived {
			continue
		}
		out = append(out, p)
	}
	return out, len(out), nil
}

func (m *mockProductRepo) ListPublicByShopSlug(ctx context.Context, slug string, filter domain.ProductFilter) ([]*domain.Product, int, error) {
	shop, err := m.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, 0, err
	}
	if shop.IsSuspended {
		return nil, 0, domain.ErrShopNotFound
	}
	active := true
	archived := false
	filter.IsActive = &active
	filter.IsArchived = &archived
	return m.ListByShop(ctx, shop.ID, filter)
}

func (m *mockProductRepo) AddImage(_ context.Context, img *domain.ProductImage, shopID string) error {
	p, ok := m.products[img.ProductID]
	if !ok || p.ShopID != shopID {
		return domain.ErrProductNotFound
	}
	m.imgID++
	img.ID = fmt.Sprintf("img-%d", m.imgID)
	img.SortOrder = len(m.images[img.ProductID])
	stored := *img
	m.images[img.ProductID] = append(m.images[img.ProductID], &stored)
	return nil
}

func (m *mockProductRepo) DeleteImage(_ context.Context, imageID, productID, shopID string) error {
	p, ok := m.products[productID]
	if !ok || p.ShopID != shopID {
		return domain.ErrProductNotFound
	}
	imgs := m.images[productID]
	for i, img := range imgs {
		if img.ID == imageID {
			m.images[productID] = append(imgs[:i], imgs[i+1:]...)
			return nil
		}
	}
	return domain.ErrProductNotFound
}

func (m *mockProductRepo) ListImages(_ context.Context, productID, shopID string) ([]*domain.ProductImage, error) {
	p, ok := m.products[productID]
	if !ok || p.ShopID != shopID {
		return nil, domain.ErrProductNotFound
	}
	out := make([]*domain.ProductImage, 0, len(m.images[productID]))
	out = append(out, m.images[productID]...)
	return out, nil
}

func (m *mockProductRepo) CountImages(_ context.Context, productID, shopID string) (int, error) {
	p, ok := m.products[productID]
	if !ok || p.ShopID != shopID {
		return 0, domain.ErrProductNotFound
	}
	return len(m.images[productID]), nil
}

func (m *mockProductRepo) ReorderImages(_ context.Context, productID, shopID string, imageIDs []string) error {
	p, ok := m.products[productID]
	if !ok || p.ShopID != shopID {
		return domain.ErrProductNotFound
	}
	byID := make(map[string]*domain.ProductImage)
	for _, img := range m.images[productID] {
		byID[img.ID] = img
	}
	reordered := make([]*domain.ProductImage, 0, len(imageIDs))
	for i, id := range imageIDs {
		img, ok := byID[id]
		if !ok {
			return domain.ErrProductNotFound
		}
		img.SortOrder = i
		reordered = append(reordered, img)
	}
	m.images[productID] = reordered
	return nil
}

// --- Test helpers ---

func newTestProductService(t *testing.T) (*ProductService, *mockShopRepo, *mockCategoryRepo, *mockProductRepo) {
	t.Helper()
	shopRepo := newMockShopRepo()
	catRepo := newMockCategoryRepo()
	prodRepo := newMockProductRepo(shopRepo)
	files := newMockFileStorage()
	svc := NewProductService(shopRepo, catRepo, prodRepo, files)
	return svc, shopRepo, catRepo, prodRepo
}

func mustCreateShop(t *testing.T, shopRepo *mockShopRepo, ownerID, slug string) *domain.Shop {
	t.Helper()
	shop := &domain.Shop{OwnerUserID: ownerID, Slug: slug, Name: "Shop " + slug}
	if err := shopRepo.Create(context.Background(), shop); err != nil {
		t.Fatalf("create shop: %v", err)
	}
	return shop
}

// --- Tests: basic CRUD ---

func TestProductCreate_Success(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	p, err := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name:     "T-Shirt",
		PriceBDT: "450.00",
		Stock:    10,
		IsActive: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Name != "T-Shirt" {
		t.Errorf("expected name T-Shirt, got %q", p.Name)
	}
	if !p.IsActive {
		t.Error("expected IsActive true")
	}
}

// --- Tests: validation ---

func TestProductCreate_InvalidPrice(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	_, err := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "-5.00", Stock: 1, IsActive: true,
	})
	if err != domain.ErrInvalidPrice {
		t.Errorf("expected ErrInvalidPrice, got %v", err)
	}

	_, err = svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "0", Stock: 1, IsActive: true,
	})
	if err != domain.ErrInvalidPrice {
		t.Errorf("expected ErrInvalidPrice for zero, got %v", err)
	}
}

func TestProductCreate_InvalidStock(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	_, err := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: -1, IsActive: true,
	})
	if err != domain.ErrInvalidStock {
		t.Errorf("expected ErrInvalidStock, got %v", err)
	}
}

func TestProductCreate_NameRequired(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	_, err := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})
	if err != domain.ErrProductNameRequired {
		t.Errorf("expected ErrProductNameRequired, got %v", err)
	}
}

// --- Tests: ownership / cross-shop isolation ---

func TestProductUpdate_CrossShopRejected(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "shop-one")
	mustCreateShop(t, shopRepo, "user-2", "shop-two")

	p, err := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "Owned", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// user-2 tries to update user-1's product.
	newName := "Hijacked"
	_, err = svc.UpdateProduct(context.Background(), "user-2", p.ID, UpdateProductInput{
		Name: &newName,
	})
	if err != domain.ErrProductNotFound {
		t.Errorf("expected ErrProductNotFound for cross-shop update, got %v", err)
	}
}

func TestProductDelete_CrossShopRejected(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "shop-one")
	mustCreateShop(t, shopRepo, "user-2", "shop-two")

	p, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})

	err := svc.DeleteProduct(context.Background(), "user-2", p.ID)
	if err != domain.ErrProductNotFound {
		t.Errorf("expected ErrProductNotFound, got %v", err)
	}
}

// --- Tests: cross-shop category rejection ---

func TestProductCreate_CategoryCrossShopRejected(t *testing.T) {
	svc, shopRepo, catRepo, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "shop-one")
	otherShop := mustCreateShop(t, shopRepo, "user-2", "shop-two")

	// Seed a category belonging to user-2's shop.
	otherCat := &domain.Category{ShopID: otherShop.ID, Name: "Electronics"}
	if err := catRepo.Create(context.Background(), otherCat); err != nil {
		t.Fatalf("seed category: %v", err)
	}

	_, err := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: 1, IsActive: true,
		CategoryID: &otherCat.ID,
	})
	if err != domain.ErrCategoryNotInShop {
		t.Errorf("expected ErrCategoryNotInShop, got %v", err)
	}
}

func TestProductUpdate_CategoryCrossShopRejected(t *testing.T) {
	svc, shopRepo, catRepo, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "shop-one")
	otherShop := mustCreateShop(t, shopRepo, "user-2", "shop-two")

	p, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})

	otherCat := &domain.Category{ShopID: otherShop.ID, Name: "Evil"}
	_ = catRepo.Create(context.Background(), otherCat)

	_, err := svc.UpdateProduct(context.Background(), "user-1", p.ID, UpdateProductInput{
		CategoryID: &otherCat.ID,
	})
	if err != domain.ErrCategoryNotInShop {
		t.Errorf("expected ErrCategoryNotInShop, got %v", err)
	}
}

// --- Tests: image limit ---

func TestUploadImage_EnforceMaxImages(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	p, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})

	for i := 0; i < domain.MaxProductImages; i++ {
		_, err := svc.UploadImage(context.Background(), "user-1", p.ID, strings.NewReader("img"), "x.png")
		if err != nil {
			t.Fatalf("upload %d failed: %v", i, err)
		}
	}

	_, err := svc.UploadImage(context.Background(), "user-1", p.ID, strings.NewReader("img"), "x.png")
	if err != domain.ErrTooManyImages {
		t.Errorf("expected ErrTooManyImages, got %v", err)
	}
}

func TestUploadImage_CrossShopRejected(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "shop-one")
	mustCreateShop(t, shopRepo, "user-2", "shop-two")

	p, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})

	_, err := svc.UploadImage(context.Background(), "user-2", p.ID, strings.NewReader("img"), "x.png")
	if err != domain.ErrProductNotFound {
		t.Errorf("expected ErrProductNotFound, got %v", err)
	}
}

// --- Tests: public listing hides inactive/archived/suspended ---

func TestListPublicProducts_HidesInactiveAndArchived(t *testing.T) {
	svc, shopRepo, _, prodRepo := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	active, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "Active", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})
	inactive, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "Inactive", PriceBDT: "10.00", Stock: 1, IsActive: false,
	})
	archived, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "Archived", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})
	_ = prodRepo.Archive(context.Background(), archived.ID, archived.ShopID)

	products, _, err := svc.ListPublicProducts(context.Background(), "my-shop", domain.ProductFilter{Page: 1, PageSize: 20})
	if err != nil {
		t.Fatalf("list public: %v", err)
	}

	seen := map[string]bool{}
	for _, p := range products {
		seen[p.ID] = true
	}
	if !seen[active.ID] {
		t.Error("expected active product to appear publicly")
	}
	if seen[inactive.ID] {
		t.Error("inactive product leaked to public listing")
	}
	if seen[archived.ID] {
		t.Error("archived product leaked to public listing")
	}
}

func TestListPublicProducts_SuspendedShop404(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	shop := mustCreateShop(t, shopRepo, "user-1", "my-shop")

	// Suspend directly in the mock repo.
	shop.IsSuspended = true
	shopRepo.shops[shop.ID] = shop

	_, _, err := svc.ListPublicProducts(context.Background(), "my-shop", domain.ProductFilter{Page: 1, PageSize: 20})
	if err != domain.ErrShopNotFound {
		t.Errorf("expected ErrShopNotFound for suspended shop, got %v", err)
	}
}

// --- Tests: archive flow ---

func TestArchiveProduct_Success(t *testing.T) {
	svc, shopRepo, _, _ := newTestProductService(t)
	mustCreateShop(t, shopRepo, "user-1", "my-shop")

	p, _ := svc.CreateProduct(context.Background(), "user-1", CreateProductInput{
		Name: "X", PriceBDT: "10.00", Stock: 1, IsActive: true,
	})

	archived, err := svc.ArchiveProduct(context.Background(), "user-1", p.ID)
	if err != nil {
		t.Fatalf("archive: %v", err)
	}
	if !archived.IsArchived {
		t.Error("expected IsArchived true after archive")
	}
}
