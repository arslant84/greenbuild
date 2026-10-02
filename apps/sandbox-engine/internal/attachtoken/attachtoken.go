// Package attachtoken verifies the short-lived tokens that let a browser attach to a sandbox
// terminal. The API issues one per attempt (architecture.md: JWT, 60 seconds to connect,
// bound to the attempt and the user); the engine accepts a WebSocket only with a valid one.
package attachtoken

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	// Audience keeps tokens issued for other purposes from opening terminals.
	Audience = "sandbox-attach"
	// MinSecretBytes is the HS256 key size; a shorter secret is easier to brute-force.
	MinSecretBytes = 32
	// MaxLifetime caps exp - iat: a token is only for connecting, never for later reuse.
	MaxLifetime = 60 * time.Second
	// clockSkew tolerates small clock differences between the API and the engine.
	clockSkew = 5 * time.Second
)

var (
	// ErrWeakSecret is returned when the signing secret is shorter than MinSecretBytes.
	ErrWeakSecret = errors.New("attach secret is too short")
	// ErrInvalidToken is wrapped by every verification failure; callers show only this.
	ErrInvalidToken = errors.New("invalid attach token")
)

// Claims are what the API puts in an attach token.
type Claims struct {
	SandboxID string `json:"sandbox_id"`
	AttemptID string `json:"attempt_id"`
	jwt.RegisteredClaims
}

// Attach is a verified permission for one user to open one sandbox's terminal.
type Attach struct {
	SandboxID string
	AttemptID string
	UserID    string
}

// Verifier checks attach tokens signed with a shared HS256 secret.
type Verifier struct {
	secret []byte
	now    func() time.Time
}

// NewVerifier refuses secrets shorter than MinSecretBytes.
func NewVerifier(secret []byte) (*Verifier, error) {
	if len(secret) < MinSecretBytes {
		return nil, fmt.Errorf("%w: %d bytes, need at least %d", ErrWeakSecret, len(secret), MinSecretBytes)
	}
	return &Verifier{secret: secret, now: time.Now}, nil
}

// Verify accepts only HS256 tokens for Audience that name a sandbox, an attempt and a user,
// carry iat and exp, and live at most MaxLifetime.
func (v *Verifier) Verify(token string) (Attach, error) {
	var claims Claims
	_, err := jwt.ParseWithClaims(token, &claims, v.key,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithAudience(Audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(clockSkew),
		jwt.WithTimeFunc(v.now),
	)
	if err != nil {
		return Attach{}, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
	if err := checkClaims(claims); err != nil {
		return Attach{}, err
	}
	return Attach{SandboxID: claims.SandboxID, AttemptID: claims.AttemptID, UserID: claims.Subject}, nil
}

func (v *Verifier) key(*jwt.Token) (any, error) {
	return v.secret, nil
}

func checkClaims(claims Claims) error {
	if claims.SandboxID == "" || claims.AttemptID == "" || claims.Subject == "" {
		return fmt.Errorf("%w: sandbox_id, attempt_id and sub are required", ErrInvalidToken)
	}
	if claims.IssuedAt == nil {
		return fmt.Errorf("%w: iat is required", ErrInvalidToken)
	}
	if lifetime := claims.ExpiresAt.Sub(claims.IssuedAt.Time); lifetime > MaxLifetime {
		return fmt.Errorf("%w: lifetime %s exceeds %s", ErrInvalidToken, lifetime, MaxLifetime)
	}
	return nil
}
