package analytics

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/handler/http/middleware"
)

type reportService struct {
	SalesService
	called   bool
	owner    string
	from, to time.Time
}

func (s *reportService) OrderReport(ctx context.Context, owner string, from, to time.Time) (*domain.OrderReport, error) {
	s.called, s.owner, s.from, s.to = true, owner, from, to
	return &domain.OrderReport{TotalOrders: 3, StatusCounts: map[string]int{"delivered": 1, "cancelled": 2}, StatusRevenueBDT: map[string]string{"delivered": "125.00"}, TopProducts: []domain.TopProduct{{ProductID: "product", ProductName: "Tea", TotalQuantity: 2, TotalRevenueBDT: "100.00"}}}, nil
}
func TestSalesReportDateValidation(t *testing.T) {
	for _, query := range []string{"", "?from=invalid&to=2026-01-01", "?from=2026-01-01&to=2025-01-01", "?from=2024-01-01&to=2026-01-01"} {
		t.Run(query, func(t *testing.T) {
			s := &reportService{}
			h := &Handler{sales: s}
			w := httptest.NewRecorder()
			h.SalesReport(w, httptest.NewRequest("GET", "/"+query, nil))
			if w.Code != 400 || s.called {
				t.Fatalf("status=%d called=%v", w.Code, s.called)
			}
		})
	}
}
func TestSalesReportMapsWindowAndOwner(t *testing.T) {
	s := &reportService{}
	h := &Handler{sales: s}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/?from=2026-01-01&to=2026-01-31", nil)
	r = r.WithContext(context.WithValue(r.Context(), middleware.UserIDKey, "seller-one"))
	h.SalesReport(w, r)
	if w.Code != 200 || s.owner != "seller-one" || s.from.Format("2006-01-02") != "2026-01-01" || s.to.Format("2006-01-02") != "2026-01-31" {
		t.Fatalf("incorrect scope: %+v status=%d", s, w.Code)
	}
	var body struct {
		Data struct {
			TotalOrders int   `json:"total_orders"`
			Daily       []any `json:"daily"`
			Products    []struct {
				Value string `json:"total_revenue_bdt"`
			} `json:"products"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Data.TotalOrders != 3 || body.Data.Daily == nil || len(body.Data.Products) != 1 || body.Data.Products[0].Value != "100.00" {
		t.Fatalf("unexpected response: %s", w.Body.String())
	}
}
