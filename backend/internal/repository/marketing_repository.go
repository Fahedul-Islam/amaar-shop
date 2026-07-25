package repository

import (
	"context"
	"time"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// MarketingRepository persists ad spend and answers unit-economics questions
// (profit, ROAS, CAC) by joining orders, order items and ad spend.
type MarketingRepository interface {
	// UpsertAdSpend records spend for a (shop, date, platform), replacing any
	// existing entry for that combination.
	UpsertAdSpend(ctx context.Context, s *domain.AdSpend) error

	// ListAdSpend returns spend entries within an inclusive date range,
	// newest first.
	ListAdSpend(ctx context.Context, shopID string, from, to time.Time) ([]domain.AdSpend, error)

	// DeleteAdSpend removes a spend entry owned by the shop.
	DeleteAdSpend(ctx context.Context, shopID, id string) error

	// ProfitSummary computes realised revenue, COGS and ad spend for a period.
	ProfitSummary(ctx context.Context, shopID string, from, to time.Time) (*domain.ProfitSummary, error)

	// ProductProfit ranks products by realised profit within a period.
	ProductProfit(ctx context.Context, shopID string, from, to time.Time, limit int) ([]domain.ProductProfit, error)

	// ListAdBudgets returns every recurring daily budget for a shop.
	ListAdBudgets(ctx context.Context, shopID string) ([]domain.AdBudget, error)

	// UpsertAdBudget creates or replaces the budget for a (shop, platform).
	UpsertAdBudget(ctx context.Context, b *domain.AdBudget) error

	// FillEstimatedSpend materialises spend rows from active budgets for every
	// day from the budget's start date through today (Bangladesh time) that has
	// no entry yet. It is idempotent: existing rows — whether seller-confirmed
	// or previously estimated — are never overwritten. Returns rows created.
	FillEstimatedSpend(ctx context.Context, today string, maxBackfillDays int) (int, error)
}
