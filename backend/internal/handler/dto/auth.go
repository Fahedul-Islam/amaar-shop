package dto

import "time"

// SignupRequest is the JSON body for POST /api/auth/signup.
type SignupRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest is the JSON body for POST /api/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse is returned after successful signup or login.
type AuthResponse struct {
	AccessToken string   `json:"access_token"`
	User        UserDTO  `json:"user"`
}

// TokenResponse is returned after a successful token refresh.
type TokenResponse struct {
	AccessToken string `json:"access_token"`
}

// UserDTO is the public representation of a user (password hash excluded).
type UserDTO struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	IsAdmin   bool      `json:"is_admin"`
	CreatedAt time.Time `json:"created_at"`
}

// MessageResponse is a simple response with a message field.
type MessageResponse struct {
	Message string `json:"message"`
}
