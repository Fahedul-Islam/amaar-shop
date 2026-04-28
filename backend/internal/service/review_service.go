package service

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"errors"
	"io"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// ReviewService handles review creation, listing, and owner replies.
type ReviewService struct {
	reviews repository.ReviewRepository
	shops   repository.ShopRepository
	files   storage.FileStorage
}

func NewReviewService(
	reviews repository.ReviewRepository,
	shops repository.ShopRepository,
	files storage.FileStorage,
) *ReviewService {
	return &ReviewService{reviews: reviews, shops: shops, files: files}
}

// CreateReviewInput is the validated payload for a customer leaving a review.
type CreateReviewInput struct {
	OrderItemID   string
	CustomerPhone string
	Rating        int
	Body          string
	ImageURL      *string
}

// CreateReview validates that the order is delivered and the phone matches,
// then inserts a review for the order item.
func (s *ReviewService) CreateReview(ctx context.Context, in CreateReviewInput) (*domain.Review, error) {
	if in.Rating < 1 || in.Rating > 5 {
		return nil, domain.ErrInvalidRating
	}

	octx, err := s.reviews.FindOrderItemForReview(ctx, in.OrderItemID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrOrderNotFound
		}
		return nil, err
	}

	if subtle.ConstantTimeCompare([]byte(octx.CustomerPhone), []byte(in.CustomerPhone)) != 1 {
		return nil, domain.ErrOrderNotFound
	}
	if octx.OrderStatus != domain.Delivered {
		return nil, domain.ErrOrderNotDelivered
	}
	if octx.AlreadyReview {
		return nil, domain.ErrReviewAlreadyExists
	}

	review := &domain.Review{
		ShopID:        octx.ShopID,
		ProductID:     octx.ProductID,
		OrderID:       octx.OrderID,
		OrderItemID:   in.OrderItemID,
		CustomerName:  octx.CustomerName,
		CustomerPhone: octx.CustomerPhone,
		Rating:        in.Rating,
		Body:          strings.TrimSpace(in.Body),
		ImageURL:      in.ImageURL,
		ProductName:   octx.ProductName,
	}
	if err := s.reviews.Create(ctx, review); err != nil {
		return nil, err
	}
	return review, nil
}

// UploadReviewImage saves a review image and returns the public URL.
func (s *ReviewService) UploadReviewImage(_ context.Context, file io.Reader, filename string) (string, error) {
	return s.files.Save(file, "review", filename)
}

// ListShopReviews returns reviews for a shop (public).
func (s *ReviewService) ListShopReviews(ctx context.Context, slug string, limit, offset int) ([]*domain.Review, int, domain.ShopRating, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return nil, 0, domain.ShopRating{}, err
	}
	if shop.IsSuspended {
		return nil, 0, domain.ShopRating{}, domain.ErrShopNotFound
	}
	reviews, total, err := s.reviews.ListByShop(ctx, shop.ID, limit, offset)
	if err != nil {
		return nil, 0, domain.ShopRating{}, err
	}
	rating, err := s.reviews.ShopRating(ctx, shop.ID)
	if err != nil {
		return nil, 0, domain.ShopRating{}, err
	}
	return reviews, total, rating, nil
}

// ListProductReviews returns reviews for a single product.
func (s *ReviewService) ListProductReviews(ctx context.Context, productID string, limit, offset int) ([]*domain.Review, int, domain.ProductRating, error) {
	reviews, total, err := s.reviews.ListByProduct(ctx, productID, limit, offset)
	if err != nil {
		return nil, 0, domain.ProductRating{}, err
	}
	rating, err := s.reviews.ProductRating(ctx, productID)
	if err != nil {
		return nil, 0, domain.ProductRating{}, err
	}
	return reviews, total, rating, nil
}

// ListOwnerReviews returns reviews for the authenticated owner's shop.
func (s *ReviewService) ListOwnerReviews(ctx context.Context, ownerUserID string, limit, offset int) ([]*domain.Review, int, domain.ShopRating, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerUserID)
	if err != nil {
		return nil, 0, domain.ShopRating{}, err
	}
	reviews, total, err := s.reviews.ListByShop(ctx, shop.ID, limit, offset)
	if err != nil {
		return nil, 0, domain.ShopRating{}, err
	}
	rating, err := s.reviews.ShopRating(ctx, shop.ID)
	if err != nil {
		return nil, 0, domain.ShopRating{}, err
	}
	return reviews, total, rating, nil
}

// ReplyToReview lets a shop owner attach a reply to a review on their shop.
func (s *ReviewService) ReplyToReview(ctx context.Context, ownerUserID, reviewID, reply string) (*domain.Review, error) {
	reply = strings.TrimSpace(reply)
	if reply == "" {
		return nil, domain.ErrEmptyReply
	}
	return s.reviews.SetOwnerReply(ctx, ownerUserID, reviewID, reply)
}

// ShopRatingBySlug returns the public rating summary for a shop slug.
func (s *ReviewService) ShopRatingBySlug(ctx context.Context, slug string) (domain.ShopRating, error) {
	shop, err := s.shops.FindBySlug(ctx, slug)
	if err != nil {
		return domain.ShopRating{}, err
	}
	return s.reviews.ShopRating(ctx, shop.ID)
}
