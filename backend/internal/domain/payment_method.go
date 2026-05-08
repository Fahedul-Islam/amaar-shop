package domain

import (
	"errors"
	"strings"
	"time"
)

// ShopPaymentMethod is one accepted way for a buyer to send the advance delivery
// fee. A shop may have multiple methods configured; all active ones are
// surfaced to the buyer at checkout.
type ShopPaymentMethod struct {
	ID           string `json:"id"`
	ShopID       string `json:"shop_id"`
	MethodType   string `json:"method_type"` // PaymentMethodTypeBank | PaymentMethodTypeMobile
	DisplayOrder int    `json:"display_order"`
	IsActive     bool   `json:"is_active"`

	// Bank fields (populated when MethodType == PaymentMethodTypeBank)
	BankName      string `json:"bank_name,omitempty"`
	AccountNumber string `json:"account_number,omitempty"`
	AccountName   string `json:"account_name,omitempty"`
	Branch        string `json:"branch,omitempty"`
	RoutingNumber string `json:"routing_number,omitempty"`

	// Mobile-banking fields (populated when MethodType == PaymentMethodTypeMobile)
	MBProvider   string `json:"mb_provider,omitempty"`
	MBPhone      string `json:"mb_phone,omitempty"`
	MBNumberType string `json:"mb_number_type,omitempty"` // personal | agent | merchant

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

const (
	PaymentMethodTypeBank   = "bank"
	PaymentMethodTypeMobile = "mobile_banking"

	MBNumberTypePersonal = "personal"
	MBNumberTypeAgent    = "agent"
	MBNumberTypeMerchant = "merchant"
)

var (
	ErrPaymentMethodNotFound = errors.New("payment method not found")
	ErrInvalidMethodType     = errors.New("payment method type must be bank or mobile_banking")
	ErrBankFieldsRequired    = errors.New("bank name, account number, and account name are required for bank payment methods")
	ErrMobileFieldsRequired  = errors.New("provider, phone, and number type are required for mobile banking methods")
	ErrInvalidMBNumberType   = errors.New("mobile banking number type must be personal, agent, or merchant")

	// Order-level errors for the advance-payment flow.
	ErrAdvancePaymentRequired = errors.New("this shop requires advance delivery fee payment proof")
	ErrOrderLocked            = errors.New("order can no longer be edited")
	ErrPaymentMethodNotInShop = errors.New("payment method does not belong to this shop")
)

// Validate checks that the per-type required fields are populated and
// trims/normalizes string fields. Returns a domain error suitable for the
// HTTP response.
func (p *ShopPaymentMethod) Validate() error {
	p.MethodType = strings.TrimSpace(strings.ToLower(p.MethodType))
	switch p.MethodType {
	case PaymentMethodTypeBank:
		p.BankName = strings.TrimSpace(p.BankName)
		p.AccountNumber = strings.TrimSpace(p.AccountNumber)
		p.AccountName = strings.TrimSpace(p.AccountName)
		p.Branch = strings.TrimSpace(p.Branch)
		p.RoutingNumber = strings.TrimSpace(p.RoutingNumber)
		if p.BankName == "" || p.AccountNumber == "" || p.AccountName == "" {
			return ErrBankFieldsRequired
		}
		// Clear unrelated mobile fields so the DB CHECK passes.
		p.MBProvider, p.MBPhone, p.MBNumberType = "", "", ""
	case PaymentMethodTypeMobile:
		p.MBProvider = strings.TrimSpace(strings.ToLower(p.MBProvider))
		p.MBPhone = strings.TrimSpace(p.MBPhone)
		p.MBNumberType = strings.TrimSpace(strings.ToLower(p.MBNumberType))
		if p.MBProvider == "" || p.MBPhone == "" || p.MBNumberType == "" {
			return ErrMobileFieldsRequired
		}
		switch p.MBNumberType {
		case MBNumberTypePersonal, MBNumberTypeAgent, MBNumberTypeMerchant:
		default:
			return ErrInvalidMBNumberType
		}
		// Clear unrelated bank fields.
		p.BankName, p.AccountNumber, p.AccountName, p.Branch, p.RoutingNumber = "", "", "", "", ""
	default:
		return ErrInvalidMethodType
	}
	return nil
}
