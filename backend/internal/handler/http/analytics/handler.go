package analytics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/config"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/dto"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
	"github.com/fhedul/amaarshop/backend/internal/handler/httputil"
)

// Handler implements the analytics endpoints.
type Handler struct {
	svc Service
	cfg *config.Config
}

func NewHandler(svc Service, cfg *config.Config) *Handler {
	return &Handler{svc: svc, cfg: cfg}
}

// TodayStats handles GET /api/shops/me/stats/today.
func (h *Handler) TodayStats(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	stats, err := h.svc.TodayStats(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	httputil.WriteJSON(w, http.StatusOK, dto.TodayStatsDTO{
		TotalOrders:   stats.TotalOrders,
		PendingOrders: stats.PendingOrders,
		RevenueBDT:    stats.RevenueBDT,
		Date:          stats.Date,
	})
}

// RangeStats handles GET /api/shops/me/stats/range?from=...&to=...
func (h *Handler) RangeStats(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")
	if fromStr == "" || toStr == "" {
		httputil.WriteValidationError(w, "from and to query parameters are required (YYYY-MM-DD)")
		return
	}

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		httputil.WriteValidationError(w, "from must be a valid date (YYYY-MM-DD)")
		return
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		httputil.WriteValidationError(w, "to must be a valid date (YYYY-MM-DD)")
		return
	}
	if to.Before(from) {
		httputil.WriteValidationError(w, "to must not be before from")
		return
	}
	if to.Sub(from).Hours() > 366*24 {
		httputil.WriteValidationError(w, "date range must not exceed 366 days")
		return
	}

	stats, err := h.svc.RangeStats(r.Context(), ownerID, from, to)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.DayStatDTO, 0, len(stats))
	for _, s := range stats {
		out = append(out, dto.DayStatDTO{
			Date:       s.Date,
			Orders:     s.Orders,
			RevenueBDT: s.RevenueBDT,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// StatsSummary handles GET /api/shops/me/stats/summary?startDate&endDate&compareStartDate&compareEndDate.
// Returns aggregate metrics (revenue, orders, AOV, visits, conversion) for
// the current window plus an optional previous window with percentage changes.
func (h *Handler) StatsSummary(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	q := r.URL.Query()
	curFrom, curTo, ok := parseRange(w, q.Get("startDate"), q.Get("endDate"), "startDate", "endDate")
	if !ok {
		return
	}

	var prevFrom, prevTo time.Time
	prevFromStr := q.Get("compareStartDate")
	prevToStr := q.Get("compareEndDate")
	if prevFromStr != "" || prevToStr != "" {
		var ok2 bool
		prevFrom, prevTo, ok2 = parseRange(w, prevFromStr, prevToStr, "compareStartDate", "compareEndDate")
		if !ok2 {
			return
		}
	}

	res, err := h.svc.StatsSummary(r.Context(), ownerID, curFrom, curTo, prevFrom, prevTo)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dto.StatsSummaryDTO{
		Current:  toPeriodSummaryDTO(res.Current),
		Previous: toPeriodSummaryPtrDTO(res.Previous),
		Changes:  toChangesDTO(res.Changes),
	})
}

func parseRange(w http.ResponseWriter, fromStr, toStr, fromName, toName string) (time.Time, time.Time, bool) {
	if fromStr == "" || toStr == "" {
		httputil.WriteValidationError(w, fromName+" and "+toName+" query parameters are required (YYYY-MM-DD)")
		return time.Time{}, time.Time{}, false
	}
	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		httputil.WriteValidationError(w, fromName+" must be a valid date (YYYY-MM-DD)")
		return time.Time{}, time.Time{}, false
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		httputil.WriteValidationError(w, toName+" must be a valid date (YYYY-MM-DD)")
		return time.Time{}, time.Time{}, false
	}
	if to.Before(from) {
		httputil.WriteValidationError(w, toName+" must not be before "+fromName)
		return time.Time{}, time.Time{}, false
	}
	if to.Sub(from).Hours() > 366*24 {
		httputil.WriteValidationError(w, "date range must not exceed 366 days")
		return time.Time{}, time.Time{}, false
	}
	return from, to, true
}

func toPeriodSummaryDTO(p domain.PeriodSummary) dto.PeriodSummaryDTO {
	return dto.PeriodSummaryDTO{
		StartDate:    p.StartDate,
		EndDate:      p.EndDate,
		RevenueBDT:   p.RevenueBDT,
		Orders:       p.Orders,
		AOVBDT:       p.AOVBDT,
		TotalVisits:  p.TotalVisits,
		UniqueVisits: p.UniqueVisits,
		OrderRate:    p.OrderRate,
	}
}

func toPeriodSummaryPtrDTO(p *domain.PeriodSummary) *dto.PeriodSummaryDTO {
	if p == nil {
		return nil
	}
	d := toPeriodSummaryDTO(*p)
	return &d
}

func toChangesDTO(c *domain.SummaryChanges) *dto.SummaryChangesDTO {
	if c == nil {
		return nil
	}
	return &dto.SummaryChangesDTO{
		RevenuePct:      c.RevenuePct,
		OrdersPct:       c.OrdersPct,
		AOVPct:          c.AOVPct,
		TotalVisitsPct:  c.TotalVisitsPct,
		UniqueVisitsPct: c.UniqueVisitsPct,
		OrderRatePct:    c.OrderRatePct,
	}
}

// DashboardSummary handles GET /api/shops/me/dashboard/summary.
// Bundles the home page's action queue and cash flow snapshot in one call.
func (h *Handler) DashboardSummary(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	s, err := h.svc.DashboardSummary(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	products := make([]dto.LowStockProductDTO, 0, len(s.LowStockProducts))
	for _, p := range s.LowStockProducts {
		products = append(products, dto.LowStockProductDTO{
			ID:       p.ID,
			Name:     p.Name,
			Stock:    p.Stock,
			PriceBDT: p.PriceBDT,
		})
	}

	httputil.WriteJSON(w, http.StatusOK, dto.DashboardSummaryDTO{
		PendingOrdersCount:     s.PendingOrdersCount,
		AwaitingAdvanceCount:   s.AwaitingAdvanceCount,
		UnansweredReviewsCount: s.UnansweredReviewsCount,
		OutOfStockCount:        s.OutOfStockCount,
		LowStockCount:          s.LowStockCount,
		TodayRevenueBDT:        s.TodayRevenueBDT,
		TodayOrders:            s.TodayOrders,
		InTransitOrders:        s.InTransitOrders,
		InTransitAmountBDT:     s.InTransitAmountBDT,
		DeliveredWeekOrders:    s.DeliveredWeekOrders,
		DeliveredWeekBDT:       s.DeliveredWeekBDT,
		LowStockProducts:       products,
	})
}

// TopProducts handles GET /api/shops/me/stats/top-products.
func (h *Handler) TopProducts(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	products, err := h.svc.TopProducts(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.TopProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, dto.TopProductDTO{
			ProductID:       p.ProductID,
			ProductName:     p.ProductName,
			TotalQuantity:   p.TotalQuantity,
			TotalRevenueBDT: p.TotalRevenueBDT,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// VisitSummary handles GET /api/shops/me/visits/summary?period=daily|weekly|monthly&days=30.
// Returns a zero-filled time series the dashboard graphs directly.
func (h *Handler) VisitSummary(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	period := domain.VisitPeriod(r.URL.Query().Get("period"))
	if period == "" {
		period = domain.VisitPeriodDaily
	}
	if !period.IsValid() {
		httputil.WriteValidationError(w, "period must be daily, weekly, or monthly")
		return
	}

	days := parseDays(r.URL.Query().Get("days"), period)

	buckets, from, to, err := h.svc.VisitSummary(r.Context(), ownerID, period, days)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.VisitBucketDTO, 0, len(buckets))
	for _, b := range buckets {
		out = append(out, dto.VisitBucketDTO{
			Bucket:       b.Bucket,
			TotalVisits:  b.TotalVisits,
			UniqueVisits: b.UniqueVisits,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, dto.VisitSummaryDTO{
		Period:  string(period),
		From:    from.Format("2006-01-02"),
		To:      to.Format("2006-01-02"),
		Buckets: out,
	})
}

// TopVisitedProducts handles GET /api/shops/me/visits/top-products.
func (h *Handler) TopVisitedProducts(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	products, err := h.svc.TopVisitedProducts(r.Context(), ownerID)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.TopVisitedProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, dto.TopVisitedProductDTO{
			ProductID:    p.ProductID,
			ProductName:  p.ProductName,
			TotalVisits:  p.TotalVisits,
			UniqueVisits: p.UniqueVisits,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}

// VisitConversion handles GET /api/shops/me/visits/conversion?days=30.
func (h *Handler) VisitConversion(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r.Context())

	days := parseDays(r.URL.Query().Get("days"), domain.VisitPeriodDaily)

	c, err := h.svc.VisitConversion(r.Context(), ownerID, days)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dto.VisitConversionDTO{
		UniqueVisits: c.UniqueVisits,
		TotalVisits:  c.TotalVisits,
		OrderCount:   c.OrderCount,
		OrderRate:    c.OrderRate,
	})
}

// parseDays parses the ?days= query parameter, falling back to a sensible
// default per period and clamping to [1, 365] to bound query cost.
func parseDays(raw string, period domain.VisitPeriod) int {
	defaults := map[domain.VisitPeriod]int{
		domain.VisitPeriodDaily:   30,
		domain.VisitPeriodWeekly:  84,  // 12 weeks
		domain.VisitPeriodMonthly: 365, // 12 months
	}
	d := defaults[period]
	if raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			d = n
		}
	}
	if d < 1 {
		d = 1
	}
	if d > 365 {
		d = 365
	}
	return d
}

// PopularProducts handles GET /api/shops/by-slug/{slug}/popular-products.
func (h *Handler) PopularProducts(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")

	products, err := h.svc.PopularProducts(r.Context(), slug)
	if err != nil {
		httputil.WriteError(w, err)
		return
	}

	out := make([]dto.PopularProductDTO, 0, len(products))
	for _, p := range products {
		out = append(out, dto.PopularProductDTO{
			ProductID:     p.ProductID,
			ProductName:   p.ProductName,
			TotalQuantity: p.TotalQuantity,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, out)
}
