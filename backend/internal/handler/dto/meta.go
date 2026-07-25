package dto

// MetaSettingsDTO is the secret-free view of a shop's Conversions API setup.
// The Pixel ID and access token are never returned to the browser.
type MetaSettingsDTO struct {
	Enabled        bool `json:"enabled"`
	Configured     bool `json:"configured"`
	TrackDelivered bool `json:"track_delivered"`
	HasTestCode    bool `json:"has_test_code"`
}

// UpdateMetaSettingsRequest is the body for PUT /api/shops/me/meta-settings.
// Blank credentials keep the stored values.
type UpdateMetaSettingsRequest struct {
	PixelID        string `json:"pixel_id"`
	AccessToken    string `json:"access_token"`
	Enabled        bool   `json:"enabled"`
	TrackDelivered bool   `json:"track_delivered"`
	TestEventCode  string `json:"test_event_code"`
}
