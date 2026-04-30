// Package visit hosts the public visit-tracking endpoint.
//
// The product detail GET endpoint already auto-tracks visits server-side,
// but SPA-style client navigations need an explicit signal — that's what
// POST /api/track/product-view is for.
package visit

import (
	"context"
	"net/http"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
	visitpkg "github.com/fhedul/amaarshop/backend/internal/visit"
)

// VisitTracker is the non-blocking enqueue contract supplied by the worker.
type VisitTracker interface {
	Enqueue(v domain.ProductVisit)
}

// ProductResolver looks up shop + product. The handler depends on this
// abstraction so it can stay independent of the product service package.
type ProductResolver interface {
	ShopIDForProduct(ctx context.Context, slug, productID string) (string, bool, error)
}

// Handler exposes POST /api/track/product-view.
type Handler struct {
	tracker  VisitTracker
	resolver ProductResolver
}

func NewHandler(tracker VisitTracker, resolver ProductResolver) *Handler {
	return &Handler{tracker: tracker, resolver: resolver}
}

// RegisterRoutes mounts the visit endpoint. No auth: tracking endpoint is public.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/track/product-view", h.Track)
}

// Track handles POST /api/track/product-view. Body: {"shop_slug": "...", "product_id": "..."}.
// Always returns 204 — the client should never retry, this is fire-and-forget.
func (h *Handler) Track(w http.ResponseWriter, r *http.Request) {
	if middleware.IsBotRequest(r) {
		httputil.WriteNoContent(w)
		return
	}

	var req dto.TrackVisitRequest
	if err := httputil.DecodeJSONBody(r, &req); err != nil || req.ShopSlug == "" || req.ProductID == "" {
		httputil.WriteNoContent(w)
		return
	}

	shopID, ok, err := h.resolver.ShopIDForProduct(r.Context(), req.ShopSlug, req.ProductID)
	if err != nil || !ok {
		httputil.WriteNoContent(w)
		return
	}

	h.tracker.Enqueue(domain.ProductVisit{
		ShopID:    shopID,
		ProductID: req.ProductID,
		VisitorID: visitpkg.VisitorID(visitpkg.ClientIP(r), r.UserAgent()),
		Referrer:  r.Header.Get("Referer"),
		UserAgent: r.UserAgent(),
		VisitedAt: time.Now().UTC(),
	})
	httputil.WriteNoContent(w)
}
