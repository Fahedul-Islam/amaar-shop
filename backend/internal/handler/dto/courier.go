package dto

// CourierSettingsDTO is the secret-free view of a shop's courier configuration.
// API keys are never sent to the browser — only whether they're present.
type CourierSettingsDTO struct {
	Provider   string `json:"provider"`
	Enabled    bool   `json:"enabled"`
	Configured bool   `json:"configured"`
}

// UpdateCourierSettingsRequest is the body for PUT /api/shops/me/courier-settings.
// Blank keys keep the currently stored value.
type UpdateCourierSettingsRequest struct {
	APIKey    string `json:"api_key"`
	SecretKey string `json:"secret_key"`
	Enabled   bool   `json:"enabled"`
}

// BookCourierResponse is returned after a successful one-click booking.
type BookCourierResponse struct {
	OrderID     string `json:"order_id"`
	Status      string `json:"status"`
	CourierName string `json:"courier_name"`
	TrackingID  string `json:"tracking_id"`
}
