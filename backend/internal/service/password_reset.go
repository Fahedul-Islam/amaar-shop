package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"

	"github.com/fhedul/amaarshop/backend/internal/auth"
	"github.com/fhedul/amaarshop/backend/internal/domain"
	"github.com/fhedul/amaarshop/backend/internal/repository"
)

var ErrInvalidReset = errors.New("invalid or expired code; request a new code")
var ErrResetUnavailable = errors.New("password reset email is temporarily unavailable")

type ResetRepository interface {
	Store(context.Context, string, string) (bool, error)
	Consume(context.Context, string, string, string) (bool, error)
	Delete(context.Context, string, string) error
}
type ResetMailer interface {
	Send(context.Context, string, string) error
}
type PasswordResetService struct {
	users  repository.UserRepository
	resets ResetRepository
	mail   ResetMailer
	secret string
}

func NewPasswordResetService(users repository.UserRepository, resets ResetRepository, mail ResetMailer, secret string) *PasswordResetService {
	return &PasswordResetService{users, resets, mail, secret}
}
func (s *PasswordResetService) digest(email, code string) string {
	h := hmac.New(sha256.New, []byte(s.secret))
	h.Write([]byte(email + "\x00" + code))
	return hex.EncodeToString(h.Sum(nil))
}
func (s *PasswordResetService) Request(ctx context.Context, email string) error {
	user, err := s.users.FindByEmail(ctx, email)
	if errors.Is(err, domain.ErrUserNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return err
	}
	code := fmt.Sprintf("%06d", n.Int64())
	digest := s.digest(email, code)
	stored, err := s.resets.Store(ctx, user.ID, digest)
	if err != nil || !stored {
		return err
	}
	if err := s.mail.Send(ctx, email, code); err != nil {
		_ = s.resets.Delete(ctx, user.ID, digest)
		// Keep the same public response for existing and unknown accounts.
		return fmt.Errorf("%w: %v", ErrResetUnavailable, err)
	}
	return nil
}
func (s *PasswordResetService) Reset(ctx context.Context, email, code, password string) error {
	if len(password) < 8 || len(password) > 72 {
		return errors.New("password must be between 8 and 72 bytes")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	ok, err := s.resets.Consume(ctx, email, s.digest(email, code), hash)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidReset
	}
	return nil
}
