package dto

import "time"

// CustomerDTO is one row in the seller's customer list.
type CustomerDTO struct {
	NormalizedPhone string     `json:"normalized_phone"`
	DisplayPhone    string     `json:"display_phone"`
	Name            string     `json:"name"`
	DeliveryArea    string     `json:"delivery_area"`
	TotalOrders     int        `json:"total_orders"`
	TotalSpentBDT   string     `json:"total_spent_bdt"`
	AvgOrderBDT     string     `json:"avg_order_bdt"`
	FirstOrderAt    *time.Time `json:"first_order_at"`
	LastOrderAt     *time.Time `json:"last_order_at"`
	Segment         string     `json:"segment"`
	Note            string     `json:"note"`
	NoteUpdatedAt   *time.Time `json:"note_updated_at"`
}

// CustomerListResponseDTO bundles a page of customers with the total count.
type CustomerListResponseDTO struct {
	Items []CustomerDTO `json:"items"`
	Total int           `json:"total"`
}

// CustomerOrderSummaryDTO is one row in a customer's order history.
type CustomerOrderSummaryDTO struct {
	OrderID    string    `json:"order_id"`
	TotalBDT   string    `json:"total_bdt"`
	Status     string    `json:"status"`
	ItemsCount int       `json:"items_count"`
	CreatedAt  time.Time `json:"created_at"`
}

// CustomerAnalyticsDTO is the segment counts + LTV summary above the list.
type CustomerAnalyticsDTO struct {
	TotalCustomers     int    `json:"total_customers"`
	NewCount           int    `json:"new_count"`
	ReturningCount     int    `json:"returning_count"`
	VIPCount           int    `json:"vip_count"`
	InactiveCount      int    `json:"inactive_count"`
	AvgLifetimeBDT     string `json:"avg_lifetime_bdt"`
	TotalLifetimeBDT   string `json:"total_lifetime_bdt"`
	RepeatPurchaseRate string `json:"repeat_purchase_rate"`
}

// UpsertCustomerNoteRequest is the body for PUT customer notes.
type UpsertCustomerNoteRequest struct {
	Note string `json:"note"`
}
