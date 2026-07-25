// Package metatracking exposes seller endpoints for Meta Conversions API
// settings plus the tracking-health and funnel statistics derived from it.
package metatracking

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	"github.com/fhedul/amaarshop/backend/internal/service"
)

// Service is the interface the handler depends on.
type Service interface {
	GetSettings(ctx context.Context, ownerID string) (*domain.MetaSettings, error)
	UpdateSettings(ctx context.Context, ownerID string, in service.UpdateMetaSettingsInput) (*domain.MetaSettings, error)
	TrackingStats(ctx context.Context, ownerID string, from, to time.Time) (*domain.TrackingStats, error)
	RecentEvents(ctx context.Context, ownerID string, limit int) ([]domain.MetaEvent, error)
	FunnelStats(ctx context.Context, ownerID string, from, to time.Time) (*domain.FunnelStats, error)
}

type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

func toSettingsDTO(s *domain.MetaSettings) dto.MetaSettingsDTO {
	return dto.MetaSettingsDTO{
		Enabled:        s.IsEnabled,
		Configured:     s.Configured(),
		TrackDelivered: s.TrackDelivered,
		HasTestCode:    s.TestEventCode != "",
	}
}

// GetSettings handles GET /api/shops/me/meta-settings.
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	s, err := h.svc.GetSettings(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toSettingsDTO(s))
}

// UpdateSettings handles PUT /api/shops/me/meta-settings.
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	var req dto.UpdateMetaSettingsRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil {
		httputil.WriteValidationError(w, "invalid JSON body")
		return
	}

	s, err := h.svc.UpdateSettings(r.Context(), ownerID, service.UpdateMetaSettingsInput{
		PixelID:        req.PixelID,
		AccessToken:    req.AccessToken,
		IsEnabled:      req.Enabled,
		TrackDelivered: req.TrackDelivered,
		TestEventCode:  req.TestEventCode,
	})
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toSettingsDTO(s))
}

// TrackingStats handles GET /api/shops/me/tracking-stats?from=&to=.
func (h *Handler) TrackingStats(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	from, to, ok := httputil.ParseDateRange(r)
	if !ok {
		httputil.WriteValidationError(w, "from/to must be YYYY-MM-DD with from before to")
		return
	}
	stats, err := h.svc.TrackingStats(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, stats)
}

// RecentEvents handles GET /api/shops/me/tracking-events?limit=.
func (h *Handler) RecentEvents(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	limit := 25
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	events, err := h.svc.RecentEvents(r.Context(), ownerID, limit)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, events)
}

// FunnelStats handles GET /api/shops/me/funnel?from=&to=.
func (h *Handler) FunnelStats(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())
	from, to, ok := httputil.ParseDateRange(r)
	if !ok {
		httputil.WriteValidationError(w, "from/to must be YYYY-MM-DD with from before to")
		return
	}
	funnel, err := h.svc.FunnelStats(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, funnel)
}
