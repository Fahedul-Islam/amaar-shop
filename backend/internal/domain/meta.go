package domain

import (
	"errors"
	"time"
)

// MetaSettings holds a shop's Conversions API credentials, pasted by the seller
// from Meta Events Manager. Secrets never reach the browser.
type MetaSettings struct {
	ShopID         string    `json:"shop_id"`
	PixelID        string    `json:"-"`
	AccessToken    string    `json:"-"`
	IsEnabled      bool      `json:"is_enabled"`
	TrackDelivered bool      `json:"track_delivered"`
	TestEventCode  string    `json:"-"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// Configured reports whether both credentials are present.
func (m MetaSettings) Configured() bool {
	return m.PixelID != "" && m.AccessToken != ""
}

// Active reports whether events should actually be sent.
func (m MetaSettings) Active() bool {
	return m.IsEnabled && m.Configured()
}

// Meta event delivery states.
const (
	MetaEventPending = "pending"
	MetaEventSent    = "sent"
	MetaEventFailed  = "failed"
)

// MetaEvent is one queued conversion. Rows are written in the request path and
// delivered asynchronously, so Meta being slow or down never affects a buyer.
type MetaEvent struct {
	ID          string     `json:"id"`
	ShopID      string     `json:"shop_id"`
	OrderID     *string    `json:"order_id,omitempty"`
	EventName   string     `json:"event_name"`
	EventID     string     `json:"event_id"`
	Status      string     `json:"status"`
	Attempts    int        `json:"attempts"`
	LastError   string     `json:"last_error,omitempty"`
	ValueBDT    string     `json:"value_bdt"`
	MatchFields int        `json:"match_fields"`
	EventTime   time.Time  `json:"event_time"`
	SentAt      *time.Time `json:"sent_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// MetaEventTypeStat is per-event-name delivery health.
type MetaEventTypeStat struct {
	EventName string `json:"event_name"`
	Sent      int    `json:"sent"`
	Pending   int    `json:"pending"`
	Failed    int    `json:"failed"`
	ValueBDT  string `json:"value_bdt"`
}

// TrackingStats is the seller-facing health report for conversion tracking:
// is it working, how much of their sales Meta actually knows about, and how
// well those conversions can be matched to real people.
type TrackingStats struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`

	Enabled    bool `json:"enabled"`
	Configured bool `json:"configured"`

	TotalSent    int `json:"total_sent"`
	TotalPending int `json:"total_pending"`
	TotalFailed  int `json:"total_failed"`

	// AvgMatchFields is the mean number of hashed identifiers per event.
	// More identifiers means Meta can attribute more conversions to ads.
	AvgMatchFields float64 `json:"avg_match_fields"`
	// MatchQualityPct expresses that as a percentage of the identifiers we
	// could realistically supply, so the seller gets a single readable number.
	MatchQualityPct float64 `json:"match_quality_pct"`

	// ReportedValueBDT is the conversion value Meta was told about.
	ReportedValueBDT string `json:"reported_value_bdt"`

	// LastError surfaces the most recent failure so a broken token is obvious.
	LastError   string     `json:"last_error,omitempty"`
	LastSentAt  *time.Time `json:"last_sent_at,omitempty"`
	ByEventType []MetaEventTypeStat `json:"by_event_type"`
}

// FunnelStats is the shop's own conversion funnel, computed from stored visits
// and orders — not from Meta. It answers "where am I losing people?".
type FunnelStats struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`

	ProductViews   int `json:"product_views"`
	UniqueVisitors int `json:"unique_visitors"`
	OrdersPlaced   int `json:"orders_placed"`
	OrdersDelivered int `json:"orders_delivered"`

	// Step-to-step conversion rates as percentages. Nil when the preceding
	// step had no traffic (undefined rather than zero).
	ViewToOrderPct      *float64 `json:"view_to_order_pct"`
	OrderToDeliveredPct *float64 `json:"order_to_delivered_pct"`
	ViewToDeliveredPct  *float64 `json:"view_to_delivered_pct"`
}

var (
	ErrMetaNotConfigured = errors.New("Meta tracking is not set up — add your Pixel ID and access token in Settings")
	ErrInvalidPixelID    = errors.New("pixel ID is required")
)
