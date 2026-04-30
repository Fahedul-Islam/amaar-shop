package domain

import (
	"errors"
	"time"
)

// CustomerSegment is a mutually-exclusive label assigned to each customer.
// Priority (high → low): VIP > Inactive > Returning > New. The first match
// wins so every customer falls into exactly one bucket.
type CustomerSegment string

const (
	SegmentVIP       CustomerSegment = "vip"
	SegmentInactive  CustomerSegment = "inactive"
	SegmentReturning CustomerSegment = "returning"
	SegmentNew       CustomerSegment = "new"
)

// IsValidCustomerSegment accepts the four canonical segment values.
func IsValidCustomerSegment(s string) bool {
	switch CustomerSegment(s) {
	case SegmentVIP, SegmentInactive, SegmentReturning, SegmentNew:
		return true
	}
	return false
}

// Customer is a buyer aggregated across their orders within one shop.
// Identified by NormalizedPhone (the seller-facing key used in URLs).
type Customer struct {
	NormalizedPhone string          `json:"normalized_phone"`
	DisplayPhone    string          `json:"display_phone"`
	Name            string          `json:"name"`
	DeliveryArea    string          `json:"delivery_area"`
	TotalOrders     int             `json:"total_orders"`
	TotalSpentBDT   string          `json:"total_spent_bdt"`
	AvgOrderBDT     string          `json:"avg_order_bdt"`
	FirstOrderAt    *time.Time      `json:"first_order_at"`
	LastOrderAt     *time.Time      `json:"last_order_at"`
	Segment         CustomerSegment `json:"segment"`
	Note            string          `json:"note"`
	NoteUpdatedAt   *time.Time      `json:"note_updated_at"`
}

// CustomerListFilters narrows the seller's customer list.
type CustomerListFilters struct {
	Segment CustomerSegment // empty → all
	Search  string          // matches name or phone substring
	Sort    string          // recent | orders | spent | name
	Limit   int
	Offset  int
}

// CustomerAnalytics is the aggregate dashboard above the customer list.
type CustomerAnalytics struct {
	TotalCustomers     int    `json:"total_customers"`
	NewCount           int    `json:"new_count"`
	ReturningCount     int    `json:"returning_count"`
	VIPCount           int    `json:"vip_count"`
	InactiveCount      int    `json:"inactive_count"`
	AvgLifetimeBDT     string `json:"avg_lifetime_bdt"`
	TotalLifetimeBDT   string `json:"total_lifetime_bdt"`
	RepeatPurchaseRate string `json:"repeat_purchase_rate"` // % with ≥2 orders, formatted "12.5"
}

// CustomerOrderSummary is one row in a customer's order history.
type CustomerOrderSummary struct {
	OrderID    string    `json:"order_id"`
	TotalBDT   string    `json:"total_bdt"`
	Status     string    `json:"status"`
	ItemsCount int       `json:"items_count"`
	CreatedAt  time.Time `json:"created_at"`
}

var (
	ErrCustomerNotFound = errors.New("customer not found")
	ErrInvalidPhone     = errors.New("invalid phone number")
)
