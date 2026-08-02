// Package meta integrates with Meta's Conversions API — server-side conversion
// tracking for Facebook and Instagram ads.
//
// Events are sent from our server rather than the buyer's browser, so they
// survive iOS App Tracking Transparency, ad blockers and cookie restrictions
// that silently drop a large share of browser-pixel events.
//
// Personal data never leaves here in the clear: every identifier is SHA-256
// hashed, which is what Meta expects and requires.
package meta

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DefaultGraphBaseURL is Meta's Graph API root. Override via META_GRAPH_BASE_URL
// (used to point at a local stub in tests).
const DefaultGraphBaseURL = "https://graph.facebook.com/v21.0"

// Standard event names. Purchase is Meta's canonical conversion; OrderDelivered
// is a custom event that only fires once a cash-on-delivery parcel is actually
// accepted, letting sellers optimise for buyers who really pay.
const (
	EventPurchase  = "Purchase"
	EventDelivered = "OrderDelivered"
)

// UserData carries the identifiers Meta matches against its users. Every field
// is plain text here and hashed on the way out.
type UserData struct {
	Phone      string
	Email      string
	FirstName  string
	LastName   string
	City       string
	State      string
	Country    string // ISO-2, e.g. "bd"
	ExternalID string
	ClientIP   string
	UserAgent  string
}

// Event is one conversion to report.
type Event struct {
	Name          string
	EventID       string // dedup key shared with the browser pixel
	EventTime     time.Time
	Value         float64
	Currency      string
	OrderID       string
	ContentIDs    []string
	User          UserData
	TestEventCode string
}

// Result reports what Meta accepted.
type Result struct {
	EventsReceived int    `json:"events_received"`
	FBTraceID      string `json:"fbtrace_id"`
}

// APIError carries Meta's own error message so the seller sees the real reason
// (expired token, wrong pixel, malformed field) rather than a generic failure.
type APIError struct {
	Message string
	// Retryable distinguishes transient faults (network, 5xx, rate limit) from
	// permanent ones (bad token) so the dispatcher doesn't retry forever.
	Retryable bool
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return "the Meta request failed"
	}
	return e.Message
}

// Client posts conversion events to the Graph API.
type Client struct {
	http    *http.Client
	baseURL string
}

func NewClient(hc *http.Client, baseURL string) *Client {
	if hc == nil {
		hc = &http.Client{Timeout: 15 * time.Second}
	}
	if baseURL == "" {
		baseURL = DefaultGraphBaseURL
	}
	return &Client{http: hc, baseURL: strings.TrimRight(baseURL, "/")}
}

// hash normalises then SHA-256 hashes a value, per Meta's matching rules:
// trim, lowercase, hex digest. Blank input yields blank output so we never
// send a hash of the empty string (which would match nobody and drag down the
// match-quality score).
func hash(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:])
}

// normalizePhone renders a Bangladeshi number in the international form Meta
// matches best: country code, digits only, no plus. 01712345678 → 8801712345678.
func normalizePhone(phone string) string {
	var digits strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	switch {
	case d == "":
		return ""
	case strings.HasPrefix(d, "880"):
		return d
	case strings.HasPrefix(d, "0"):
		return "880" + d[1:]
	default:
		return d
	}
}

// buildUserData hashes the identity fields and reports how many were populated.
// The count feeds the seller's match-quality statistic: more identifiers means
// Meta can attribute more of their conversions.
func buildUserData(u UserData) (map[string]any, int) {
	out := map[string]any{}
	matched := 0

	add := func(key, value string) {
		if h := hash(value); h != "" {
			out[key] = []string{h}
			matched++
		}
	}

	add("ph", normalizePhone(u.Phone))
	add("em", u.Email)
	add("fn", u.FirstName)
	add("ln", u.LastName)
	add("ct", u.City)
	add("st", u.State)
	add("country", u.Country)
	add("external_id", u.ExternalID)

	// IP and user-agent are sent unhashed by design — Meta uses them for
	// matching and explicitly expects them in the clear.
	if u.ClientIP != "" {
		out["client_ip_address"] = u.ClientIP
	}
	if u.UserAgent != "" {
		out["client_user_agent"] = u.UserAgent
	}
	return out, matched
}

// MatchFieldCount reports how many hashed identifiers an event would carry,
// without sending anything. Used to record match quality at enqueue time.
func MatchFieldCount(u UserData) int {
	_, n := buildUserData(u)
	return n
}

// Send posts one event. Errors are *APIError with Meta's message where available.
func (c *Client) Send(ctx context.Context, pixelID, accessToken string, e Event) (Result, error) {
	userData, _ := buildUserData(e.User)

	customData := map[string]any{
		"currency": e.Currency,
		"value":    e.Value,
	}
	if e.OrderID != "" {
		customData["order_id"] = e.OrderID
	}
	if len(e.ContentIDs) > 0 {
		customData["content_ids"] = e.ContentIDs
		customData["content_type"] = "product"
	}

	payload := map[string]any{
		"data": []map[string]any{{
			"event_name":    e.Name,
			"event_time":    e.EventTime.Unix(),
			"event_id":      e.EventID,
			"action_source": "website",
			"user_data":     userData,
			"custom_data":   customData,
		}},
	}
	if e.TestEventCode != "" {
		payload["test_event_code"] = e.TestEventCode
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return Result{}, &APIError{Message: err.Error()}
	}

	url := fmt.Sprintf("%s/%s/events?access_token=%s", c.baseURL, pixelID, accessToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return Result{}, &APIError{Message: err.Error()}
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		// Network-level failure: worth retrying later.
		return Result{}, &APIError{Message: "could not reach Meta: " + err.Error(), Retryable: true}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	if resp.StatusCode/100 != 2 {
		var errBody struct {
			Error struct {
				Message   string `json:"message"`
				Type      string `json:"type"`
				Code      int    `json:"code"`
				FBTraceID string `json:"fbtrace_id"`
			} `json:"error"`
		}
		_ = json.Unmarshal(raw, &errBody)
		msg := strings.TrimSpace(errBody.Error.Message)
		if msg == "" {
			msg = fmt.Sprintf("Meta rejected the event (HTTP %d)", resp.StatusCode)
		}
		// 5xx and 429 are transient; 4xx (bad token, bad pixel) are not and
		// retrying just burns quota.
		retryable := resp.StatusCode >= 500 || resp.StatusCode == http.StatusTooManyRequests
		return Result{}, &APIError{Message: msg, Retryable: retryable}
	}

	var ok Result
	_ = json.Unmarshal(raw, &ok)
	return ok, nil
}
