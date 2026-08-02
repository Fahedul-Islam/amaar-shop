package repository

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// FeeRuleRepository owns the singleton platform fee rule.
type FeeRuleRepository interface {
	// Get returns the current platform-wide fee rule. Always seeded by
	// migration so this never returns ErrNotFound under normal conditions.
	Get(ctx context.Context) (*domain.FeeRule, error)

	// Update overwrites the singleton rule and stamps updated_by/updated_at.
	Update(ctx context.Context, in domain.UpdateFeeRuleInput) (*domain.FeeRule, error)
}

// FeeSubmissionRepository handles seller-submitted fee payment claims.
type FeeSubmissionRepository interface {
	// Create inserts a new pending submission.
	Create(ctx context.Context, sub *domain.FeeSubmission) error

	// FindByID returns one submission joined with shop info.
	FindByID(ctx context.Context, id string) (*domain.AdminFeeSubmissionRow, error)

	// HasPending returns true if the shop has a submission that's still pending review.
	// Sellers are blocked from sending a second one until admin acts on the first.
	HasPending(ctx context.Context, shopID string) (bool, error)

	// List returns paginated submissions with optional filters.
	List(ctx context.Context, f domain.FeeSubmissionListFilter) ([]domain.AdminFeeSubmissionRow, int, error)

	// CountByStatus returns counts grouped by status — for tab badges.
	CountByStatus(ctx context.Context) (map[string]int, error)

	// MarkApproved transitions to approved + links to the created fee_payment.
	MarkApproved(ctx context.Context, submissionID, feePaymentID, adminFeedback, adminUserID string) error

	// MarkRejected transitions to rejected with feedback.
	MarkRejected(ctx context.Context, submissionID, adminFeedback, adminUserID string) error

	// RecentForShop returns the N most recent submissions for one shop.
	RecentForShop(ctx context.Context, shopID string, limit int) ([]domain.FeeSubmission, error)
}
