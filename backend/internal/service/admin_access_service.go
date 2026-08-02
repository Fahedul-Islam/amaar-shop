package service

import (
	"context"

	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

// AdminAccessService answers "who is an admin" and manages the admin team.
// It is the gate every other admin surface is checked against, so it stays
// deliberately small — the billing handler depends on IsAdmin alone.
type AdminAccessService struct {
	team  repository.AdminTeamRepository
	users repository.UserRepository
}

func NewAdminAccessService(
	team repository.AdminTeamRepository,
	users repository.UserRepository,
) *AdminAccessService {
	return &AdminAccessService{team: team, users: users}
}

// IsAdmin returns true if the given user has admin privileges.
// Used by the handler middleware to gate every /api/admin/* request.
func (s *AdminAccessService) IsAdmin(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, nil
	}
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return user.IsAdmin, nil
}

// ListAdmins returns every admin team member.
func (s *AdminAccessService) ListAdmins(ctx context.Context) ([]domain.AdminTeamMember, error) {
	return s.team.ListAdmins(ctx)
}

// SetUserAdmin promotes or demotes a user. Refuses self-demotion to avoid
// the lockout trap where the only admin removes their own access.
func (s *AdminAccessService) SetUserAdmin(ctx context.Context, callerID, targetID string, isAdmin bool) error {
	if !isAdmin && callerID == targetID {
		return domain.ErrCannotDemoteSelf
	}
	return s.team.SetUserAdmin(ctx, targetID, isAdmin)
}
