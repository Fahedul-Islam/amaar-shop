package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// MarketingService owns ad-spend bookkeeping and the unit-economics report.
// Repositories return raw sums; the derived ratios (ROAS, CAC, break-even)
// are computed here so the maths lives in one testable place.
type MarketingService struct {
	shops     repository.ShopRepository
	marketing repository.MarketingRepository
}

func NewMarketingService(shops repository.ShopRepository, marketing repository.MarketingRepository) *MarketingService {
	return &MarketingService{shops: shops, marketing: marketing}
}

// RecordAdSpendInput is one day's spend on one platform.
type RecordAdSpendInput struct {
	SpendDate string
	Platform  string
	AmountBDT string
	Note      string
}

// RecordAdSpend validates and upserts a spend entry.
func (s *MarketingService) RecordAdSpend(ctx context.Context, ownerID string, in RecordAdSpendInput) (*domain.AdSpend, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	platform := strings.ToLower(strings.TrimSpace(in.Platform))
	if !domain.IsValidAdPlatform(platform) {
		return nil, domain.ErrInvalidAdPlatform
	}

	date := strings.TrimSpace(in.SpendDate)
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return nil, domain.ErrInvalidSpendDate
	}

	amount, err := strconv.ParseFloat(strings.TrimSpace(in.AmountBDT), 64)
	if err != nil || amount < 0 {
		return nil, domain.ErrInvalidAdAmount
	}

	entry := &domain.AdSpend{
		ShopID:    shop.ID,
		SpendDate: date,
		Platform:  platform,
		AmountBDT: fmt.Sprintf("%.2f", amount),
		Note:      strings.TrimSpace(in.Note),
	}
	if err := s.marketing.UpsertAdSpend(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

// ListAdSpend returns spend entries in the given inclusive range.
func (s *MarketingService) ListAdSpend(ctx context.Context, ownerID string, from, to time.Time) ([]domain.AdSpend, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	return s.marketing.ListAdSpend(ctx, shop.ID, from, to)
}

// DeleteAdSpend removes one spend entry.
func (s *MarketingService) DeleteAdSpend(ctx context.Context, ownerID, id string) error {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return err
	}
	return s.marketing.DeleteAdSpend(ctx, shop.ID, id)
}

// ListAdBudgets returns the shop's recurring daily budgets.
func (s *MarketingService) ListAdBudgets(ctx context.Context, ownerID string) ([]domain.AdBudget, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	return s.marketing.ListAdBudgets(ctx, shop.ID)
}

// SetAdBudgetInput declares a recurring daily spend for one platform.
type SetAdBudgetInput struct {
	Platform       string
	DailyAmountBDT string
	IsActive       bool
}

// SetAdBudget saves a daily budget and immediately materialises the spend rows
// for it, so the seller sees the effect on their profit report right away
// instead of waiting for the next nightly run.
func (s *MarketingService) SetAdBudget(ctx context.Context, ownerID string, in SetAdBudgetInput) (*domain.AdBudget, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	platform := strings.ToLower(strings.TrimSpace(in.Platform))
	if !domain.IsValidAdPlatform(platform) {
		return nil, domain.ErrInvalidAdPlatform
	}
	amount, err := strconv.ParseFloat(strings.TrimSpace(in.DailyAmountBDT), 64)
	if err != nil || amount < 0 {
		return nil, domain.ErrInvalidAdAmount
	}

	budget := &domain.AdBudget{
		ShopID:         shop.ID,
		Platform:       platform,
		DailyAmountBDT: fmt.Sprintf("%.2f", amount),
		IsActive:       in.IsActive,
		// Start from the seller's today in Dhaka, not the database's UTC
		// CURRENT_DATE — otherwise enabling a budget after 6pm UTC would
		// backfill a day of spend the seller never agreed to. On update the
		// repository keeps the original start date.
		StartsOn: domain.TodayBD(),
	}
	if err := s.marketing.UpsertAdBudget(ctx, budget); err != nil {
		return nil, err
	}
	if budget.IsActive && amount > 0 {
		if _, err := s.marketing.FillEstimatedSpend(ctx, domain.TodayBD(), DefaultBackfillDays); err != nil {
			return nil, err
		}
	}
	return budget, nil
}

// ProfitSummary returns the period's unit economics with all derived ratios
// filled in.
func (s *MarketingService) ProfitSummary(ctx context.Context, ownerID string, from, to time.Time) (*domain.ProfitSummary, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	summary, err := s.marketing.ProfitSummary(ctx, shop.ID, from, to)
	if err != nil {
		return nil, err
	}
	enrichProfitSummary(summary)
	return summary, nil
}

// ProductProfit ranks products by realised profit, filling in margin.
func (s *MarketingService) ProductProfit(ctx context.Context, ownerID string, from, to time.Time, limit int) ([]domain.ProductProfit, error) {
	shop, err := s.shops.FindByOwnerID(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := s.marketing.ProductProfit(ctx, shop.ID, from, to, limit)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		revenue := parseMoney(rows[i].RevenueBDT)
		cogs := parseMoney(rows[i].COGSBDT)
		profit := revenue - cogs
		rows[i].ProfitBDT = money(profit)
		if revenue > 0 {
			rows[i].MarginPct = pct(profit / revenue * 100)
		}
	}
	return rows, nil
}

// enrichProfitSummary computes profit and every ratio from the raw sums.
// Ratios whose denominator is zero stay nil — "undefined", not "zero" — so the
// UI can show a dash instead of a misleading 0.
func enrichProfitSummary(s *domain.ProfitSummary) {
	revenue := parseMoney(s.DeliveredRevenueBDT)
	cogs := parseMoney(s.COGSBDT)
	spend := parseMoney(s.AdSpendBDT)

	grossProfit := revenue - cogs
	netProfit := grossProfit - spend
	s.GrossProfitBDT = money(grossProfit)
	s.NetProfitBDT = money(netProfit)

	if revenue > 0 {
		margin := grossProfit / revenue * 100
		s.GrossMarginPct = pct(margin)
		// Break-even ROAS is how many taka of revenue each ad taka must return
		// just to cover the goods. Only meaningful with a positive margin.
		if grossProfit > 0 {
			s.BreakEvenROAS = pct(1 / (grossProfit / revenue))
		}
	}
	if spend > 0 {
		s.ROAS = pct(revenue / spend)
	}
	if s.TotalOrders > 0 {
		s.CostPerOrderBDT = moneyPtr(spend / float64(s.TotalOrders))
	}
	if s.DeliveredOrders > 0 {
		s.CACDeliveredBDT = moneyPtr(spend / float64(s.DeliveredOrders))
		s.AOVBDT = moneyPtr(revenue / float64(s.DeliveredOrders))
		s.ProfitPerOrderBDT = moneyPtr(netProfit / float64(s.DeliveredOrders))
	}
	if settled := s.DeliveredOrders + s.ReturnedOrders; settled > 0 {
		s.DeliverySuccessPct = pct(float64(s.DeliveredOrders) / float64(settled) * 100)
	}
}

func parseMoney(v string) float64 {
	f, _ := strconv.ParseFloat(v, 64)
	return f
}

func money(v float64) string { return fmt.Sprintf("%.2f", v) }

func moneyPtr(v float64) *string {
	s := money(v)
	return &s
}

// pct rounds to two decimals and returns a pointer.
func pct(v float64) *float64 {
	rounded := float64(int64(v*100+0.5)) / 100
	if v < 0 {
		rounded = float64(int64(v*100-0.5)) / 100
	}
	return &rounded
}
