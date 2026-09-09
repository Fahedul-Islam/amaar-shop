package service

import (
	"context"
	"errors"
	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"testing"
)

type resetStore struct {
	hash, password string
	stored         bool
	consumed       bool
}

func (r *resetStore) Store(_ context.Context, _, hash string) (bool, error) {
	if r.stored {
		return false, nil
	}
	r.hash = hash
	r.stored = true
	return true, nil
}
func (r *resetStore) Delete(_ context.Context, _, hash string) error {
	if r.hash == hash {
		r.stored = false
	}
	return nil
}
func (r *resetStore) Consume(_ context.Context, _, hash, password string) (bool, error) {
	if !r.stored || r.consumed || r.hash != hash {
		return false, nil
	}
	r.password = password
	r.consumed = true
	return true, nil
}

type resetMail struct {
	code  string
	calls int
	err   error
}

func (m *resetMail) Send(_ context.Context, _, code string) error {
	m.code = code
	m.calls++
	return m.err
}
func TestPasswordReset(t *testing.T) {
	for _, admin := range []bool{false, true} {
		t.Run(map[bool]string{false: "seller", true: "admin"}[admin], func(t *testing.T) {
			ctx := context.Background()
			users := newMockUserRepo()
			u := &domain.User{Email: "owner@example.com", IsAdmin: admin}
			users.Create(ctx, u)
			store := &resetStore{}
			mail := &resetMail{}
			svc := NewPasswordResetService(users, store, mail, testSecret)
			if err := svc.Request(ctx, u.Email); err != nil {
				t.Fatal(err)
			}
			if len(mail.code) != 6 || store.hash == mail.code {
				t.Fatal("expected six-digit code stored as a digest")
			}
			svc.Request(ctx, u.Email)
			if mail.calls != 1 {
				t.Fatal("resend cooldown ignored")
			}
			if err := svc.Reset(ctx, u.Email, "xxxxxx", "newpassword"); !errors.Is(err, ErrInvalidReset) {
				t.Fatal(err)
			}
			if err := svc.Reset(ctx, u.Email, mail.code, "newpassword"); err != nil {
				t.Fatal(err)
			}
			if !auth.CheckPassword("newpassword", store.password) {
				t.Fatal("password not hashed")
			}
			if u.IsAdmin != admin {
				t.Fatal("role changed")
			}
			if err := svc.Reset(ctx, u.Email, mail.code, "otherpassword"); !errors.Is(err, ErrInvalidReset) {
				t.Fatal("code reused")
			}
		})
	}
}
func TestResetUnknownAndDeliveryFailure(t *testing.T) {
	ctx := context.Background()
	users := newMockUserRepo()
	store := &resetStore{}
	mail := &resetMail{err: errors.New("unavailable")}
	svc := NewPasswordResetService(users, store, mail, testSecret)
	if err := svc.Request(ctx, "missing@example.com"); err != nil || mail.calls != 0 {
		t.Fatal("unknown account sent email")
	}
	users.Create(ctx, &domain.User{Email: "owner@example.com"})
	if err := svc.Request(ctx, "owner@example.com"); !errors.Is(err, ErrResetUnavailable) || store.stored {
		t.Fatal("failed delivery retained code")
	}
}
func TestSeedAdminRejectsSellerCollision(t *testing.T) {
	users := newMockUserRepo()
	u := &domain.User{Email: "owner@example.com"}
	users.Create(context.Background(), u)
	if err := NewAuthService(users, testSecret).SeedAdmin(context.Background(), u.Email, "password123"); err == nil || u.IsAdmin {
		t.Fatal("seller collision must be explicit without automatic promotion")
	}
}
func TestRefreshRevokedAfterPasswordChange(t *testing.T) {
	ctx := context.Background()
	users := newMockUserRepo()
	svc := NewAuthService(users, testSecret)
	u, tokens, err := svc.Signup(ctx, "owner@example.com", "oldpassword")
	if err != nil {
		t.Fatal(err)
	}
	u.PasswordHash, _ = auth.HashPassword("newpassword")
	if _, err = svc.Refresh(ctx, tokens.RefreshToken); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatal("old refresh token accepted")
	}
	_, tokens, err = svc.Login(ctx, u.Email, "newpassword")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = svc.Refresh(ctx, tokens.RefreshToken); err != nil {
		t.Fatal(err)
	}
}
