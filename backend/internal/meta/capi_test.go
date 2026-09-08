package meta

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"01712345678":      "8801712345678", // local trunk zero → country code
		"+880 1712-345678": "8801712345678",
		"8801712345678":    "8801712345678",
		"01712-345 678":    "8801712345678",
		"":                 "",
	}
	for in, want := range cases {
		if got := normalizePhone(in); got != want {
			t.Errorf("normalizePhone(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestHash_NormalisesBeforeHashing(t *testing.T) {
	// Meta requires trim+lowercase before hashing; these must collide.
	if hash("  Karim@Example.COM ") != hash("karim@example.com") {
		t.Error("hash should normalise case and whitespace")
	}
	// Blank must stay blank — hashing "" would send a digest matching nobody.
	if hash("   ") != "" {
		t.Error("blank input must produce blank hash, not a digest")
	}
	// Known SHA-256 of "test" to catch an algorithm swap.
	const wantTest = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
	if got := hash("test"); got != wantTest {
		t.Errorf("hash(\"test\") = %s, want %s", got, wantTest)
	}
}

func TestBuildUserData_HashesAndCounts(t *testing.T) {
	u := UserData{
		Phone:     "01712345678",
		FirstName: "Karim",
		City:      "Dhaka",
		Country:   "bd",
		ClientIP:  "203.0.113.9",
		UserAgent: "Mozilla/5.0",
	}
	out, matched := buildUserData(u)

	if matched != 4 {
		t.Errorf("expected 4 hashed identity fields, got %d", matched)
	}
	// Raw PII must never appear in the payload.
	blob, _ := json.Marshal(out)
	for _, raw := range []string{"01712345678", "8801712345678", "Karim", "karim", "Dhaka", "dhaka"} {
		if strings.Contains(string(blob), raw) {
			t.Errorf("payload leaked raw value %q: %s", raw, blob)
		}
	}
	// IP and UA are deliberately unhashed.
	if out["client_ip_address"] != "203.0.113.9" {
		t.Error("client_ip_address must be sent in the clear")
	}
	if out["client_user_agent"] != "Mozilla/5.0" {
		t.Error("client_user_agent must be sent in the clear")
	}
	if _, ok := out["em"]; ok {
		t.Error("absent email must be omitted, not sent as an empty hash")
	}
}

func TestSend_SuccessPayloadShape(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		if !strings.Contains(r.URL.Path, "/PIXEL123/events") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if r.URL.Query().Get("access_token") != "TOKEN" {
			t.Error("access token not forwarded")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"events_received":1,"fbtrace_id":"abc"}`))
	}))
	defer srv.Close()

	res, err := NewClient(srv.Client(), srv.URL).Send(context.Background(), "PIXEL123", "TOKEN", Event{
		Name:      EventDelivered,
		EventID:   "order-1-delivered",
		EventTime: time.Unix(1785000000, 0),
		Value:     500,
		Currency:  "BDT",
		OrderID:   "order-1",
		User:      UserData{Phone: "01712345678"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.EventsReceived != 1 {
		t.Errorf("events_received = %d, want 1", res.EventsReceived)
	}

	data := got["data"].([]any)[0].(map[string]any)
	if data["event_name"] != EventDelivered {
		t.Errorf("event_name = %v", data["event_name"])
	}
	if data["event_id"] != "order-1-delivered" {
		t.Errorf("event_id must be sent for browser-pixel dedup, got %v", data["event_id"])
	}
	if data["action_source"] != "website" {
		t.Errorf("action_source = %v", data["action_source"])
	}
	if data["event_time"].(float64) != 1785000000 {
		t.Errorf("event_time should be unix seconds, got %v", data["event_time"])
	}
	custom := data["custom_data"].(map[string]any)
	if custom["value"].(float64) != 500 || custom["currency"] != "BDT" {
		t.Errorf("custom_data value/currency wrong: %v", custom)
	}
}

func TestSend_ErrorClassification(t *testing.T) {
	cases := []struct {
		name          string
		status        int
		body          string
		wantRetryable bool
		wantMsg       string
	}{
		{
			name:    "bad token is permanent",
			status:  http.StatusBadRequest,
			body:    `{"error":{"message":"Invalid OAuth access token."}}`,
			wantMsg: "Invalid OAuth access token.",
		},
		{
			name:          "server error is retryable",
			status:        http.StatusInternalServerError,
			body:          `{"error":{"message":"Please retry"}}`,
			wantRetryable: true,
			wantMsg:       "Please retry",
		},
		{
			name:          "rate limit is retryable",
			status:        http.StatusTooManyRequests,
			body:          `{"error":{"message":"Rate limited"}}`,
			wantRetryable: true,
			wantMsg:       "Rate limited",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()

			_, err := NewClient(srv.Client(), srv.URL).Send(context.Background(), "P", "T", Event{Name: EventPurchase})
			apiErr, ok := err.(*APIError)
			if !ok {
				t.Fatalf("expected *APIError, got %T", err)
			}
			if apiErr.Message != tc.wantMsg {
				t.Errorf("message = %q, want %q", apiErr.Message, tc.wantMsg)
			}
			if apiErr.Retryable != tc.wantRetryable {
				t.Errorf("retryable = %v, want %v", apiErr.Retryable, tc.wantRetryable)
			}
		})
	}
}
