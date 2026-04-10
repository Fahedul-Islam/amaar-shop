package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	AccessTokenDuration  = 15 * time.Minute
	RefreshTokenDuration = 7 * 24 * time.Hour
)

var ErrInvalidToken = errors.New("invalid or expired token")

// Claims is the JWT payload for both access and refresh tokens.
type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// GenerateAccessToken creates a short-lived JWT for API authentication.
func GenerateAccessToken(userID, secret string) (string, error) {
	return generateToken(userID, secret, AccessTokenDuration, "access")
}

// GenerateRefreshToken creates a long-lived JWT stored in an httpOnly cookie.
func GenerateRefreshToken(userID, secret string) (string, error) {
	return generateToken(userID, secret, RefreshTokenDuration, "refresh")
}

func generateToken(userID, secret string, duration time.Duration, subject string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken parses and validates a JWT, returning the claims if valid.
// The expectedSubject parameter ensures the token type (access/refresh) matches.
func ValidateToken(tokenStr, secret, expectedSubject string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	if claims.Subject != expectedSubject {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
