package domain

import (
	"errors"
	"strconv"
	"time"
)

// ----- Fee rule (admin-configurable) ---------------------------------------

// FeeRuleType is what kind of fee the platform charges. Two clean shapes:
//   - "percentage":      value × shop's GMV (as a %, e.g. 5.0)
//   - "fixed_per_order": value × non-cancelled order count
//
// Both flow naturally from "orders since last payment", so the seller's due
// is always trivial to compute. If we need fixed_monthly later we can add
// a third type without breaking these two.
type FeeRuleType string

const (
	FeeRuleTypePercentage    FeeRuleType = "percentage"
	FeeRuleTypeFixedPerOrder FeeRuleType = "fixed_per_order"
)

// IsValidFeeRuleType returns true if t is a known rule type.
func IsValidFeeRuleType(t string) bool {
	return FeeRuleType(t) == FeeRuleTypePercentage || FeeRuleType(t) == FeeRuleTypeFixedPerOrder
}

// FeeRule is the platform-wide fee setting. There's exactly one row.
// It supersedes the old hard-coded PlatformFeeRate constant.
type FeeRule struct {
	RuleType    FeeRuleType `json:"rule_type"`
	// Value is a numeric string for precision.
	// For percentage: "5.0000" means 5%.
	// For fixed_per_order: "10.00" means ৳10 per order.
	Value       string      `json:"value"`
	Description string      `json:"description,omitempty"`
	UpdatedAt   time.Time   `json:"updated_at"`
	UpdatedBy   *string     `json:"updated_by,omitempty"`
}

// HumanLabel returns "5% of sales" or "৳10 per order" for UI display.
// Kept on the domain so handlers and the seller UI render it identically.
func (r FeeRule) HumanLabel() string {
	v := r.Value
	switch r.RuleType {
	case FeeRuleTypePercentage:
		return v + "% of sales"
	case FeeRuleTypeFixedPerOrder:
		return "BDT " + v + " per order"
	}
	return ""
}

// Apply computes the fee owed for the given window of orders. The window is
// described by aggregate counts (gmv, order count) so this method has no
// dependency on the order list itself — services pass already-aggregated
// numbers.
func (r FeeRule) Apply(unbilledGMV string, unbilledOrders int) string {
	gmv, _ := strconv.ParseFloat(unbilledGMV, 64)
	switch r.RuleType {
	case FeeRuleTypePercentage:
		v, _ := strconv.ParseFloat(r.Value, 64)
		return fmt2(gmv * v / 100)
	case FeeRuleTypeFixedPerOrder:
		v, _ := strconv.ParseFloat(r.Value, 64)
		return fmt2(v * float64(unbilledOrders))
	}
	return "0.00"
}

// fmt2 formats a money value as a 2-decimal string.
func fmt2(v float64) string {
	return strconv.FormatFloat(v, 'f', 2, 64)
}

// UpdateFeeRuleInput is the admin's payload when changing the rule.
type UpdateFeeRuleInput struct {
	RuleType    string
	Value       string
	Description string
	UpdatedBy   string
}

// ----- Fee submissions (seller → admin payment claim) ----------------------

// FeeSubmissionStatus is where one submission stands in admin review.
type FeeSubmissionStatus string

const (
	FeeSubmissionStatusPending  FeeSubmissionStatus = "pending"
	FeeSubmissionStatusApproved FeeSubmissionStatus = "approved"
	FeeSubmissionStatusRejected FeeSubmissionStatus = "rejected"
)

// IsValidFeeSubmissionStatus returns true if s is a known status.
func IsValidFeeSubmissionStatus(s string) bool {
	switch FeeSubmissionStatus(s) {
	case FeeSubmissionStatusPending, FeeSubmissionStatusApproved, FeeSubmissionStatusRejected:
		return true
	}
	return false
}

// PaymentMethod describes how the seller claims they paid the platform.
type PaymentMethod string

const (
	PaymentMethodBkash        PaymentMethod = "bkash"
	PaymentMethodNagad        PaymentMethod = "nagad"
	PaymentMethodRocket       PaymentMethod = "rocket"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodCash         PaymentMethod = "cash"
	PaymentMethodOther        PaymentMethod = "other"
)

// ValidPaymentMethods is the canonical allow-list for client-side dropdowns
// and server-side validation.
var ValidPaymentMethods = []PaymentMethod{
	PaymentMethodBkash, PaymentMethodNagad, PaymentMethodRocket,
	PaymentMethodBankTransfer, PaymentMethodCash, PaymentMethodOther,
}

// IsValidPaymentMethod returns true if m is a known method.
func IsValidPaymentMethod(m string) bool {
	for _, v := range ValidPaymentMethods {
		if string(v) == m {
			return true
		}
	}
	return false
}

// FeeSubmission is one seller-initiated fee payment claim.
type FeeSubmission struct {
	ID             string              `json:"id"`
	ShopID         string              `json:"shop_id"`
	AmountBDT      string              `json:"amount_bdt"`
	PaymentMethod  PaymentMethod       `json:"payment_method"`
	TransactionID  string              `json:"transaction_id"`
	SenderAccount  string              `json:"sender_account,omitempty"`
	Note           string              `json:"note,omitempty"`
	Status         FeeSubmissionStatus `json:"status"`
	AdminFeedback  string              `json:"admin_feedback,omitempty"`
	ReviewedBy     *string             `json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time          `json:"reviewed_at,omitempty"`
	FeePaymentID   *string             `json:"fee_payment_id,omitempty"`
	SubmittedAt    time.Time           `json:"submitted_at"`
}

// AdminFeeSubmissionRow is FeeSubmission joined with shop info for the
// admin review queue.
type AdminFeeSubmissionRow struct {
	FeeSubmission
	ShopName string `json:"shop_name"`
	ShopSlug string `json:"shop_slug"`
}

// CreateFeeSubmissionInput is the seller's payload when claiming a payment.
type CreateFeeSubmissionInput struct {
	ShopID        string
	AmountBDT     string
	PaymentMethod string
	TransactionID string
	SenderAccount string
	Note          string
}

// ReviewFeeSubmissionInput is the admin's payload when approving or rejecting.
// CoversUntil is only used on approval — it sets the timestamp on the
// shop_fee_payments row that gets created. If zero, "now" is used.
type ReviewFeeSubmissionInput struct {
	SubmissionID  string
	NewStatus     string
	AdminFeedback string
	CoversUntil   time.Time
	AdminUserID   string
}

// ShopBillingSnapshot is what a seller sees on their billing page: the
// current rule, what they owe right now, and the last few payments.
type ShopBillingSnapshot struct {
	Rule              FeeRule          `json:"rule"`
	UnbilledOrders    int              `json:"unbilled_orders"`
	UnbilledGMVBDT    string           `json:"unbilled_gmv_bdt"`
	OutstandingFeeBDT string           `json:"outstanding_fee_bdt"`
	LastPaidAt        *string          `json:"last_paid_at,omitempty"`
	DaysSinceLastPaid *int             `json:"days_since_last_paid,omitempty"`
	Status            FeeStatus        `json:"status"`
	HasPendingSubmission bool          `json:"has_pending_submission"`
	RecentSubmissions []FeeSubmission  `json:"recent_submissions"`
}

var (
	ErrFeeRuleInvalidType   = errors.New("fee rule type must be 'percentage' or 'fixed_per_order'")
	ErrFeeRuleInvalidValue  = errors.New("fee rule value must be a number greater than or equal to zero")
	ErrFeeRulePercentTooBig = errors.New("percentage value must be between 0 and 100")
	ErrSubmissionNotFound       = errors.New("payment submission not found")
	ErrInvalidSubmissionStatus  = errors.New("invalid submission status")
	ErrInvalidPaymentMethod     = errors.New("invalid payment method")
	ErrTransactionIDRequired    = errors.New("transaction id is required")
	ErrSubmissionAlreadyReviewed = errors.New("this submission has already been reviewed")
	ErrPendingSubmissionExists  = errors.New("you already have a pending submission — wait for admin review")
)
