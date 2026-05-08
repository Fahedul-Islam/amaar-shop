package dto

// PaymentMethodDTO is the wire representation of a seller-configured advance-
// fee payment method. Bank fields are populated when method_type is "bank";
// mobile-banking fields when method_type is "mobile_banking".
type PaymentMethodDTO struct {
	ID           string `json:"id"`
	ShopID       string `json:"shop_id,omitempty"`
	MethodType   string `json:"method_type"`
	DisplayOrder int    `json:"display_order"`
	IsActive     bool   `json:"is_active"`

	BankName      string `json:"bank_name,omitempty"`
	AccountNumber string `json:"account_number,omitempty"`
	AccountName   string `json:"account_name,omitempty"`
	Branch        string `json:"branch,omitempty"`
	RoutingNumber string `json:"routing_number,omitempty"`

	MBProvider   string `json:"mb_provider,omitempty"`
	MBPhone      string `json:"mb_phone,omitempty"`
	MBNumberType string `json:"mb_number_type,omitempty"`

	CreatedAt string `json:"created_at,omitempty"`
	UpdatedAt string `json:"updated_at,omitempty"`
}

// PaymentMethodRequest is the payload for create/update.
type PaymentMethodRequest struct {
	MethodType   string `json:"method_type"`
	DisplayOrder int    `json:"display_order"`
	IsActive     *bool  `json:"is_active"`

	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
	Branch        string `json:"branch"`
	RoutingNumber string `json:"routing_number"`

	MBProvider   string `json:"mb_provider"`
	MBPhone      string `json:"mb_phone"`
	MBNumberType string `json:"mb_number_type"`
}

// SubmitAdvanceProofRequest is the buyer-facing body for attaching proof.
type SubmitAdvanceProofRequest struct {
	CustomerPhone   string `json:"customer_phone"`
	PaymentMethodID string `json:"payment_method_id"`
	TxnRef          string `json:"txn_ref"`
	Receipt         string `json:"receipt"`
}

// BuyerEditOrderRequest is the buyer-facing body for editing pre-confirmation
// order details.
type BuyerEditOrderRequest struct {
	CustomerPhone    string `json:"customer_phone"`
	DeliveryAddress  string `json:"delivery_address"`
	DeliveryDivision string `json:"delivery_division"`
	DeliveryDistrict string `json:"delivery_district"`
	Note             string `json:"note"`
}

// MarkAdvanceReceivedRequest toggles seller confirmation.
type MarkAdvanceReceivedRequest struct {
	Received bool `json:"received"`
}

// ReceiptUploadDTO returns the URL of an uploaded receipt file.
type ReceiptUploadDTO struct {
	URL string `json:"url"`
}
