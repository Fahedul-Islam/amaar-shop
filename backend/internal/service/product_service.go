package service

import (
	"context"
	"io"
	"strconv"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// CreateProductInput carries all required fields for creating a product.
// Validation happens in the service; the handler trims and parses but doesn't
// enforce domain rules.
type CreateProductInput struct {
	Name        string
	Description string
	PriceBDT    string
	Stock       int
	CategoryID  *string
	IsActive    bool
}

// UpdateProductInput uses pointer fields so nil means "leave unchanged".
// ClearCategory=true detaches the product from its category regardless of CategoryID.
type UpdateProductInput struct {
	Name          *string
	Description   *string
	PriceBDT      *string
	Stock         *int
	CategoryID    *string
	ClearCategory bool
	IsActive      *bool
}

// ProductService enforces ownership, category-in-shop, stock/price validation,
// and image-count limits. It orchestrates shop, category, and product repos
// along with file storage for image uploads.
type ProductService struct {
	shops      repository.ShopRepository
	categories repository.CategoryRepository
	products   repository.ProductRepository
	files      storage.FileStorage
}

func NewProductService(
	shops repository.ShopRepository,
	categories repository.CategoryRepository,
	products repository.ProductRepository,
	files storage.FileStorage,
) *ProductService {
	return &ProductService{
		shops:      shops,
		categories: categories,
		products:   products,
		files:      files,
	}
}

func (s *ProductService) resolveShop(ctx context.Context, ownerUserID string) (*domain.Shop, error) {
	return s.shops.FindByOwnerID(ctx, ownerUserID)
}

func (s *ProductService) resolvePublicShop(ctx context.Context, slug string) (*domain.Shop, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if shop.IsSuspended {
		return nil, domain.ErrShopNotFound
	}
	return shop, nil
}

// verifyCategoryInShop ensures the category (if set) belongs to the same shop.
// Returns ErrCategoryNotInShop on mismatch.
func (s *ProductService) verifyCategoryInShop(ctx context.Context, categoryID *string, shopID string) error {
	if categoryID == nil || *categoryID == "" {
		return nil
	}
	c, err := s.categories.FindByID(ctx, *categoryID, shopID)
	if err != nil {
		if err == domain.ErrCategoryNotFound {
			return domain.ErrCategoryNotInShop
		}
		return err
	}
	if c.ShopID != shopID {
		return domain.ErrCategoryNotInShop
	}
	return nil
}

// validateProductFields enforces the domain rules shared by create and update.
func validateProductFields(name, priceBDT string, stock int) error {
	if name == "" {
		return domain.ErrProductNameRequired
	}
	price, err := strconv.ParseFloat(priceBDT, 64)
	if err != nil || price <= 0 {
		return domain.ErrInvalidPrice
	}
	if stock < 0 {
		return domain.ErrInvalidStock
	}
	return nil
}

func (s *ProductService) CreateProduct(ctx context.Context, ownerUserID string, in CreateProductInput) (*domain.Product, error) {
	if err := validateProductFields(in.Name, in.PriceBDT, in.Stock); err != nil {
		return nil, err
	}
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.verifyCategoryInShop(ctx, in.CategoryID, shop.ID); err != nil {
		return nil, err
	}

	var catID *string
	if in.CategoryID != nil && *in.CategoryID != "" {
		catID = in.CategoryID
	}

	p := &domain.Product{
		ShopID:      shop.ID,
		CategoryID:  catID,
		Name:        in.Name,
		Description: in.Description,
		PriceBDT:    in.PriceBDT,
		Stock:       in.Stock,
		IsActive:    in.IsActive,
	}
	if err := s.products.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *ProductService) UpdateProduct(ctx context.Context, ownerUserID, productID string, in UpdateProductInput) (*domain.Product, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	p, err := s.products.FindByID(ctx, productID, shop.ID)
	if err != nil {
		return nil, err
	}

	if in.Name != nil {
		p.Name = *in.Name
	}
	if in.Description != nil {
		p.Description = *in.Description
	}
	if in.PriceBDT != nil {
		p.PriceBDT = *in.PriceBDT
	}
	if in.Stock != nil {
		p.Stock = *in.Stock
	}
	if in.IsActive != nil {
		p.IsActive = *in.IsActive
	}
	if in.ClearCategory {
		p.CategoryID = nil
	} else if in.CategoryID != nil && *in.CategoryID != "" {
		if err := s.verifyCategoryInShop(ctx, in.CategoryID, shop.ID); err != nil {
			return nil, err
		}
		p.CategoryID = in.CategoryID
	}

	if err := validateProductFields(p.Name, p.PriceBDT, p.Stock); err != nil {
		return nil, err
	}

	if err := s.products.Update(ctx, p); err != nil {
		return nil, err
	}
	return s.products.FindByID(ctx, productID, shop.ID)
}

func (s *ProductService) ArchiveProduct(ctx context.Context, ownerUserID, productID string) (*domain.Product, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	if err := s.products.Archive(ctx, productID, shop.ID); err != nil {
		return nil, err
	}
	return s.products.FindByID(ctx, productID, shop.ID)
}

func (s *ProductService) DeleteProduct(ctx context.Context, ownerUserID, productID string) error {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return err
	}
	return s.products.Delete(ctx, productID, shop.ID)
}

func (s *ProductService) GetProduct(ctx context.Context, ownerUserID, productID string) (*domain.Product, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	return s.products.FindByID(ctx, productID, shop.ID)
}

func (s *ProductService) ListProducts(ctx context.Context, ownerUserID string, filter domain.ProductFilter) ([]*domain.Product, int, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, 0, err
	}
	return s.products.ListByShop(ctx, shop.ID, filter)
}

func (s *ProductService) ListPublicProducts(ctx context.Context, slug string, filter domain.ProductFilter) ([]*domain.Product, int, error) {
	return s.products.ListPublicByShopSlug(ctx, slug, filter)
}

func (s *ProductService) GetPublicProduct(ctx context.Context, slug, productID string) (*domain.Product, error) {
	shop, err := s.resolvePublicShop(ctx, slug)
	if err != nil {
		return nil, err
	}
	p, err := s.products.FindByID(ctx, productID, shop.ID)
	if err != nil {
		return nil, err
	}
	if !p.IsActive || p.IsArchived {
		return nil, domain.ErrProductNotFound
	}
	return p, nil
}

// --- Image operations ---

func (s *ProductService) UploadImage(ctx context.Context, ownerUserID, productID string, file io.Reader, filename string) (*domain.ProductImage, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	// Confirm the product exists in this shop before touching storage.
	if _, err := s.products.FindByID(ctx, productID, shop.ID); err != nil {
		return nil, err
	}
	count, err := s.products.CountImages(ctx, productID, shop.ID)
	if err != nil {
		return nil, err
	}
	if count >= domain.MaxProductImages {
		return nil, domain.ErrTooManyImages
	}

	url, err := s.files.Save(file, "product-img", filename)
	if err != nil {
		return nil, err
	}

	img := &domain.ProductImage{ProductID: productID, URL: url}
	if err := s.products.AddImage(ctx, img, shop.ID); err != nil {
		return nil, err
	}
	return img, nil
}

func (s *ProductService) DeleteImage(ctx context.Context, ownerUserID, productID, imageID string) error {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return err
	}
	return s.products.DeleteImage(ctx, imageID, productID, shop.ID)
}

func (s *ProductService) ReorderImages(ctx context.Context, ownerUserID, productID string, imageIDs []string) ([]*domain.ProductImage, error) {
	shop, err := s.resolveShop(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	existing, err := s.products.ListImages(ctx, productID, shop.ID)
	if err != nil {
		return nil, err
	}
	if len(existing) != len(imageIDs) {
		return nil, domain.ErrProductNotFound
	}
	existingIDs := make(map[string]bool, len(existing))
	for _, img := range existing {
		existingIDs[img.ID] = true
	}
	for _, id := range imageIDs {
		if !existingIDs[id] {
			return nil, domain.ErrProductNotFound
		}
	}
	if err := s.products.ReorderImages(ctx, productID, shop.ID, imageIDs); err != nil {
		return nil, err
	}
	return s.products.ListImages(ctx, productID, shop.ID)
}
