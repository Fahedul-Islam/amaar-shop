package service

import (
	"context"
	"testing"

	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/domain"
)

// mockUserRepo is an in-memory UserRepository for testing.
type mockUserRepo struct {
	users  map[string]*domain.User
	nextID int
}

func newMockUserRepo() *mockUserRepo {
	return &mockUserRepo{users: make(map[string]*domain.User)}
}

func (m *mockUserRepo) Create(_ context.Context, user *domain.User) error {
	for _, u := range m.users {
		if u.Email == user.Email {
			return domain.ErrEmailAlreadyExists
		}
	}
	m.nextID++
	user.ID = "test-id-" + string(rune('0'+m.nextID))
	m.users[user.ID] = user
	return nil
}

func (m *mockUserRepo) FindByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range m.users {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, domain.ErrUserNotFound
}

func (m *mockUserRepo) FindByID(_ context.Context, id string) (*domain.User, error) {
	u, ok := m.users[id]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	return u, nil
}

const testSecret = "test-jwt-secret-32-chars-long!!!"

func TestSignup_Success(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	user, tokens, err := svc.Signup(context.Background(), "test@example.com", "password123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if user.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", user.Email)
	}
	if user.IsAdmin {
		t.Error("expected non-admin user")
	}
	if tokens.AccessToken == "" {
		t.Error("expected access token")
	}
	if tokens.RefreshToken == "" {
		t.Error("expected refresh token")
	}
}

func TestSignup_DuplicateEmail(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	_, _, err := svc.Signup(context.Background(), "test@example.com", "password123")
	if err != nil {
		t.Fatalf("first signup failed: %v", err)
	}

	_, _, err = svc.Signup(context.Background(), "test@example.com", "password456")
	if err != domain.ErrEmailAlreadyExists {
		t.Errorf("expected ErrEmailAlreadyExists, got %v", err)
	}
}

func TestLogin_Success(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	_, _, err := svc.Signup(context.Background(), "test@example.com", "password123")
	if err != nil {
		t.Fatalf("signup failed: %v", err)
	}

	user, tokens, err := svc.Login(context.Background(), "test@example.com", "password123")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}
	if user.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", user.Email)
	}
	if tokens.AccessToken == "" {
		t.Error("expected access token")
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	_, _, _ = svc.Signup(context.Background(), "test@example.com", "password123")

	_, _, err := svc.Login(context.Background(), "test@example.com", "wrongpassword")
	if err != domain.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_NonexistentUser(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	_, _, err := svc.Login(context.Background(), "nonexistent@example.com", "password123")
	if err != domain.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestRefresh_Success(t *testing.T) {
	repo := newMockUserRepo()
	svc := NewAuthService(repo, testSecret)

	_, tokens, _ := svc.Signup(context.Background(), "test@example.com", "password123")

	accessToken, err := svc.Refresh(context.Background(), tokens.RefreshToken)
	if err != nil {
		t.Fatalf("refresh failed: %v", err)
	}
	if accessToken == "" {
		t.Error("expected new access token")
	}

	// Verify the new access token is valid
	claims, err := auth.ValidateToken(accessToken, testSecret, "access")
	if err != nil {
		t.Fatalf("new access token is invalid: %v", err)
	}
	if claims.UserID == "" {
		t.Error("expected user ID in claims")
	}
}

func TestRefresh_InvalidToken(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	_, err := svc.Refresh(context.Background(), "invalid-token")
	if err != domain.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestRefresh_AccessTokenRejected(t *testing.T) {
	repo := newMockUserRepo()
	svc := NewAuthService(repo, testSecret)

	_, tokens, _ := svc.Signup(context.Background(), "test@example.com", "password123")

	// Using an access token for refresh should fail
	_, err := svc.Refresh(context.Background(), tokens.AccessToken)
	if err != domain.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials for access token used as refresh, got %v", err)
	}
}

func TestMe_Success(t *testing.T) {
	repo := newMockUserRepo()
	svc := NewAuthService(repo, testSecret)

	user, _, _ := svc.Signup(context.Background(), "test@example.com", "password123")

	found, err := svc.Me(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("me failed: %v", err)
	}
	if found.Email != "test@example.com" {
		t.Errorf("expected email test@example.com, got %s", found.Email)
	}
}

func TestMe_NotFound(t *testing.T) {
	svc := NewAuthService(newMockUserRepo(), testSecret)

	_, err := svc.Me(context.Background(), "nonexistent-id")
	if err != domain.ErrUserNotFound {
		t.Errorf("expected ErrUserNotFound, got %v", err)
	}
}

func TestSeedAdmin_CreatesAdmin(t *testing.T) {
	repo := newMockUserRepo()
	svc := NewAuthService(repo, testSecret)

	err := svc.SeedAdmin(context.Background(), "admin@example.com", "adminpass123")
	if err != nil {
		t.Fatalf("seed admin failed: %v", err)
	}

	admin, err := repo.FindByEmail(context.Background(), "admin@example.com")
	if err != nil {
		t.Fatalf("admin not found: %v", err)
	}
	if !admin.IsAdmin {
		t.Error("expected admin user to have IsAdmin=true")
	}
}

func TestSeedAdmin_SkipsIfExists(t *testing.T) {
	repo := newMockUserRepo()
	svc := NewAuthService(repo, testSecret)

	_ = svc.SeedAdmin(context.Background(), "admin@example.com", "adminpass123")
	err := svc.SeedAdmin(context.Background(), "admin@example.com", "differentpass")
	if err != nil {
		t.Fatalf("second seed should not error: %v", err)
	}

	// Password should not have changed (original hash preserved)
	admin, _ := repo.FindByEmail(context.Background(), "admin@example.com")
	if !auth.CheckPassword("adminpass123", admin.PasswordHash) {
		t.Error("admin password should not have changed on re-seed")
	}
}
