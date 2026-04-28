package dto

// CreateReviewRequest is the body for POST /api/marketplace/reviews.
type CreateReviewRequest struct {
	OrderItemID   string  `json:"order_item_id"`
	CustomerPhone string  `json:"customer_phone"`
	Rating        int     `json:"rating"`
	Body          string  `json:"body"`
	ImageURL      *string `json:"image_url"`
}

// ReplyReviewRequest is the body for POST /api/shops/me/reviews/{id}/reply.
type ReplyReviewRequest struct {
	Reply string `json:"reply"`
}

// ReviewDTO is the public representation of a review.
type ReviewDTO struct {
	ID             string  `json:"id"`
	ShopID         string  `json:"shop_id"`
	ProductID      string  `json:"product_id"`
	ProductName    string  `json:"product_name"`
	OrderID        string  `json:"order_id"`
	OrderItemID    string  `json:"order_item_id"`
	CustomerName   string  `json:"customer_name"`
	Rating         int     `json:"rating"`
	Body           string  `json:"body"`
	ImageURL       *string `json:"image_url"`
	OwnerReply     *string `json:"owner_reply"`
	OwnerRepliedAt *string `json:"owner_replied_at"`
	CreatedAt      string  `json:"created_at"`
}

// ShopRatingDTO is the public aggregate rating for a shop.
type ShopRatingDTO struct {
	Average float64 `json:"average"`
	Count   int     `json:"count"`
}

// ProductRatingDTO is the public aggregate rating for a product.
type ProductRatingDTO struct {
	Average float64 `json:"average"`
	Count   int     `json:"count"`
}

// ReviewListDTO bundles a list of reviews with the aggregate rating.
type ReviewListDTO struct {
	Rating  ShopRatingDTO `json:"rating"`
	Reviews []ReviewDTO   `json:"reviews"`
}
