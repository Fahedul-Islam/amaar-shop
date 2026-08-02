package domain

import (
	"errors"
	"time"
)

// Review is a customer review of a product, anchored to a specific order item
// so each delivered order item can produce at most one review.
type Review struct {
	ID             string     `json:"id"`
	ShopID         string     `json:"shop_id"`
	ProductID      string     `json:"product_id"`
	OrderID        string     `json:"order_id"`
	OrderItemID    string     `json:"order_item_id"`
	CustomerName   string     `json:"customer_name"`
	CustomerPhone  string     `json:"customer_phone"`
	Rating         int        `json:"rating"`
	Body           string     `json:"body"`
	ImageURL       *string    `json:"image_url"`
	OwnerReply     *string    `json:"owner_reply"`
	OwnerRepliedAt *time.Time `json:"owner_replied_at"`
	ProductName    string     `json:"product_name"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// ShopRating is the aggregate rating summary for a shop.
type ShopRating struct {
	Average float64 `json:"average"`
	Count   int     `json:"count"`
}

// ProductRating is the aggregate rating summary for a product.
type ProductRating struct {
	Average float64 `json:"average"`
	Count   int     `json:"count"`
}

var (
	ErrReviewNotFound      = errors.New("review not found")
	ErrReviewAlreadyExists = errors.New("a review for this order item already exists")
	ErrOrderNotDelivered   = errors.New("order must be delivered before it can be reviewed")
	ErrInvalidRating       = errors.New("rating must be between 1 and 5")
	ErrReplyAlreadyExists  = errors.New("reply already exists for this review")
	ErrEmptyReply          = errors.New("reply cannot be empty")
)
