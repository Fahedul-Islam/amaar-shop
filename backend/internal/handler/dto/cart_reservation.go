package dto

// CartReservationItemDTO is one product line on a reservation, sent to and
// from the API.
type CartReservationItemDTO struct {
	ID        string `json:"id,omitempty"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

// CartReservationDTO is the wire-format reservation envelope.
type CartReservationDTO struct {
	ID            string                   `json:"id"`
	ShopID        string                   `json:"shop_id"`
	Status        string                   `json:"status"`
	ExpiresAt     string                   `json:"expires_at"`
	CreatedAt     string                   `json:"created_at"`
	Items         []CartReservationItemDTO `json:"items"`
	CustomerPhone string                   `json:"customer_phone,omitempty"`
}

// CreateReservationRequest is the body for POST /cart-reservations.
type CreateReservationRequest struct {
	Items []CartReservationItemDTO `json:"items"`
}
