package service

import (
	"testing"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// TestEnrichProfitSummary covers the unit-economics maths: a seller acting on
// a wrong ROAS or break-even number loses real money, so each ratio is pinned.
func TestEnrichProfitSummary(t *testing.T) {
	// 20 orders placed, 14 delivered, 4 returned, 2 still in flight.
	// Delivered revenue 7000, COGS 4200, ad spend 5000.
	s := &domain.ProfitSummary{
		TotalOrders:         20,
		DeliveredOrders:     14,
		ReturnedOrders:      4,
		InFlightOrders:      2,
		DeliveredRevenueBDT: "7000.00",
		BookedRevenueBDT:    "10000.00",
		COGSBDT:             "4200.00",
		AdSpendBDT:          "5000.00",
	}
	enrichProfitSummary(s)

	if s.GrossProfitBDT != "2800.00" {
		t.Errorf("gross profit: want 2800.00, got %s", s.GrossProfitBDT)
	}
	// The headline number: 2800 gross - 5000 ads = a 2200 loss.
	if s.NetProfitBDT != "-2200.00" {
		t.Errorf("net profit: want -2200.00, got %s", s.NetProfitBDT)
	}
	if s.GrossMarginPct == nil || *s.GrossMarginPct != 40 {
		t.Errorf("gross margin: want 40, got %v", s.GrossMarginPct)
	}
	// ROAS 7000/5000 = 1.4, but break-even needs 1/0.4 = 2.5 → campaign is losing.
	if s.ROAS == nil || *s.ROAS != 1.4 {
		t.Errorf("roas: want 1.4, got %v", s.ROAS)
	}
	if s.BreakEvenROAS == nil || *s.BreakEvenROAS != 2.5 {
		t.Errorf("break-even roas: want 2.5, got %v", s.BreakEvenROAS)
	}
	if s.CostPerOrderBDT == nil || *s.CostPerOrderBDT != "250.00" {
		t.Errorf("cost per order: want 250.00, got %v", s.CostPerOrderBDT)
	}
	// CAC on delivered orders is the honest acquisition cost: 5000/14.
	if s.CACDeliveredBDT == nil || *s.CACDeliveredBDT != "357.14" {
		t.Errorf("cac delivered: want 357.14, got %v", s.CACDeliveredBDT)
	}
	if s.AOVBDT == nil || *s.AOVBDT != "500.00" {
		t.Errorf("aov: want 500.00, got %v", s.AOVBDT)
	}
	// 14 delivered of 18 settled = 77.78%.
	if s.DeliverySuccessPct == nil || *s.DeliverySuccessPct != 77.78 {
		t.Errorf("delivery success: want 77.78, got %v", s.DeliverySuccessPct)
	}
	if s.ProfitPerOrderBDT == nil || *s.ProfitPerOrderBDT != "-157.14" {
		t.Errorf("profit per order: want -157.14, got %v", s.ProfitPerOrderBDT)
	}
}

// Zero denominators must yield nil ("no data") rather than 0, which would read
// as "your ROAS is zero" on the dashboard.
func TestEnrichProfitSummary_UndefinedRatios(t *testing.T) {
	s := &domain.ProfitSummary{
		DeliveredRevenueBDT: "0.00",
		BookedRevenueBDT:    "0.00",
		COGSBDT:             "0.00",
		AdSpendBDT:          "0.00",
	}
	enrichProfitSummary(s)

	if s.ROAS != nil {
		t.Errorf("roas should be nil with no ad spend, got %v", *s.ROAS)
	}
	if s.GrossMarginPct != nil {
		t.Errorf("margin should be nil with no revenue, got %v", *s.GrossMarginPct)
	}
	if s.CACDeliveredBDT != nil {
		t.Errorf("cac should be nil with no delivered orders, got %v", *s.CACDeliveredBDT)
	}
	if s.DeliverySuccessPct != nil {
		t.Errorf("delivery success should be nil with no settled orders, got %v", *s.DeliverySuccessPct)
	}
	if s.NetProfitBDT != "0.00" {
		t.Errorf("net profit: want 0.00, got %s", s.NetProfitBDT)
	}
}

// A profitable shop with no ads: margin and delivery rate defined, ROAS nil.
func TestEnrichProfitSummary_NoAdSpend(t *testing.T) {
	s := &domain.ProfitSummary{
		TotalOrders:         10,
		DeliveredOrders:     10,
		DeliveredRevenueBDT: "5000.00",
		COGSBDT:             "2000.00",
		AdSpendBDT:          "0.00",
	}
	enrichProfitSummary(s)

	if s.NetProfitBDT != "3000.00" {
		t.Errorf("net profit: want 3000.00, got %s", s.NetProfitBDT)
	}
	if s.ROAS != nil {
		t.Errorf("roas should be nil without spend, got %v", *s.ROAS)
	}
	if s.GrossMarginPct == nil || *s.GrossMarginPct != 60 {
		t.Errorf("margin: want 60, got %v", s.GrossMarginPct)
	}
	if s.CostPerOrderBDT == nil || *s.CostPerOrderBDT != "0.00" {
		t.Errorf("cost per order: want 0.00, got %v", s.CostPerOrderBDT)
	}
}

func TestIsValidAdPlatform(t *testing.T) {
	for _, ok := range []string{"facebook", "tiktok", "instagram", "google", "other"} {
		if !domain.IsValidAdPlatform(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", "Facebook", "twitter", "fb"} {
		if domain.IsValidAdPlatform(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}
