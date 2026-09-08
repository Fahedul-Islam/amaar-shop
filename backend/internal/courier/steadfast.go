// Package courier integrates with third-party delivery couriers. Today it
// speaks to Steadfast (packzy) — Bangladesh's most-used COD courier — using
// only the standard library, in keeping with the project's minimal-deps ethos.
package courier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DefaultSteadfastBaseURL is Steadfast's merchant API root. Override via the
// STEADFAST_BASE_URL env var (useful for pointing at a sandbox in tests).
const DefaultSteadfastBaseURL = "https://portal.packzy.com/api/v1"

// ConsignmentRequest is the courier-agnostic booking payload.
type ConsignmentRequest struct {
	Invoice          string // unique per merchant; we pass the order ID
	RecipientName    string
	RecipientPhone   string // 11-digit BD number, digits only
	RecipientAddress string
	CODAmount        float64 // cash the rider collects on delivery
	Note             string
}

// Consignment is the courier's acknowledgement of a booked parcel.
type Consignment struct {
	ConsignmentID int64
	TrackingCode  string
	Status        string
}

// APIError carries a courier-side failure message so the seller sees the real
// reason (bad phone number, insufficient balance, invalid API keys, ...).
type APIError struct {
	Message string
}

func (e *APIError) Error() string {
	if e.Message == "" {
		return "the courier request failed"
	}
	return e.Message
}

// Steadfast is a thin client over Steadfast's create_order endpoint.
type Steadfast struct {
	http    *http.Client
	baseURL string
}

// NewSteadfast builds a client. A nil http.Client gets a sane default with a
// timeout; an empty baseURL falls back to the production endpoint.
func NewSteadfast(hc *http.Client, baseURL string) *Steadfast {
	if hc == nil {
		hc = &http.Client{Timeout: 20 * time.Second}
	}
	if baseURL == "" {
		baseURL = DefaultSteadfastBaseURL
	}
	return &Steadfast{http: hc, baseURL: strings.TrimRight(baseURL, "/")}
}

// CreateConsignment books a parcel and returns its tracking code. Failures are
// returned as *APIError with the courier's own message where available.
func (s *Steadfast) CreateConsignment(ctx context.Context, apiKey, secretKey string, in ConsignmentRequest) (Consignment, error) {
	body, err := json.Marshal(map[string]any{
		"invoice":           in.Invoice,
		"recipient_name":    in.RecipientName,
		"recipient_phone":   in.RecipientPhone,
		"recipient_address": in.RecipientAddress,
		"cod_amount":        in.CODAmount,
		"note":              in.Note,
	})
	if err != nil {
		return Consignment{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/create_order", bytes.NewReader(body))
	if err != nil {
		return Consignment{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("Secret-Key", secretKey)

	resp, err := s.http.Do(req)
	if err != nil {
		return Consignment{}, &APIError{Message: "could not reach the courier service — check your connection and try again"}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	var parsed struct {
		Status      int    `json:"status"`
		Message     string `json:"message"`
		Consignment struct {
			ConsignmentID int64  `json:"consignment_id"`
			TrackingCode  string `json:"tracking_code"`
			Status        string `json:"status"`
		} `json:"consignment"`
	}
	_ = json.Unmarshal(raw, &parsed)

	if resp.StatusCode/100 != 2 || parsed.Consignment.TrackingCode == "" {
		msg := strings.TrimSpace(parsed.Message)
		if msg == "" {
			msg = fmt.Sprintf("the courier rejected the booking (HTTP %d)", resp.StatusCode)
		}
		return Consignment{}, &APIError{Message: msg}
	}

	return Consignment{
		ConsignmentID: parsed.Consignment.ConsignmentID,
		TrackingCode:  parsed.Consignment.TrackingCode,
		Status:        parsed.Consignment.Status,
	}, nil
}
