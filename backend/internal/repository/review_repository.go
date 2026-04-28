package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// ReviewRepository defines persistence operations for product reviews.
type ReviewRepository interface {
	// Create inserts a new review.
	Create(ctx context.Context, review *domain.Review) error

	// FindByID returns a review by its ID, including the product name.
	FindByID(ctx context.Context, id string) (*domain.Review, error)

	// ListByShop returns reviews for a shop, newest first.
	ListByShop(ctx context.Context, shopID string, limit, offset int) ([]*domain.Review, int, error)

	// ListByProduct returns reviews for a single product, newest first.
	ListByProduct(ctx context.Context, productID string, limit, offset int) ([]*domain.Review, int, error)

	// ShopRating returns the aggregate rating for a shop.
	ShopRating(ctx context.Context, shopID string) (domain.ShopRating, error)

	// ProductRating returns the aggregate rating for a product.
	ProductRating(ctx context.Context, productID string) (domain.ProductRating, error)

	// SetOwnerReply attaches a reply to a review, scoped to the shop owned by ownerUserID.
	SetOwnerReply(ctx context.Context, ownerUserID, reviewID, reply string) (*domain.Review, error)

	// FindOrderItemForReview returns metadata required to validate a new review:
	// the order's status, shop_id, product_id, and customer phone for the given
	// order_item, or sql.ErrNoRows if the item doesn't exist.
	FindOrderItemForReview(ctx context.Context, orderItemID string) (OrderItemReviewContext, error)
}

// OrderItemReviewContext is the metadata used by the service to validate a review.
type OrderItemReviewContext struct {
	OrderID       string
	ShopID        string
	ProductID     string
	ProductName   string
	OrderStatus   string
	CustomerName  string
	CustomerPhone string
	AlreadyReview bool
}
