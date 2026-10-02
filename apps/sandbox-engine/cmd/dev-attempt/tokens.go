package main

import (
	"fmt"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/golang-jwt/jwt/v5"
)

const (
	devUser = "dev-user"
	// ticketAudience marks the dev check ticket; the web app's dev check route accepts only it.
	ticketAudience = "dev-check"
	ticketLifetime = 2 * time.Hour
)

// grant is what both tokens are bound to.
type grant struct {
	attemptID   string
	sandboxID   string
	challengeID string
}

type ticketClaims struct {
	AttemptID   string `json:"attempt_id"`
	SandboxID   string `json:"sandbox_id"`
	ChallengeID string `json:"challenge_id"`
	jwt.RegisteredClaims
}

// signAttach issues what the API will issue: an attach token valid for attachtoken.MaxLifetime.
func signAttach(secret []byte, granted grant, now time.Time) (string, error) {
	claims := attachtoken.Claims{SandboxID: granted.sandboxID, AttemptID: granted.attemptID, RegisteredClaims: registered(attachtoken.Audience, now, attachtoken.MaxLifetime)}
	return sign(secret, claims)
}

// signTicket lets the web app's dev check route check this attempt, and nothing else, until the API exists.
func signTicket(secret []byte, granted grant, now time.Time) (string, error) {
	claims := ticketClaims{
		AttemptID: granted.attemptID, SandboxID: granted.sandboxID, ChallengeID: granted.challengeID,
		RegisteredClaims: registered(ticketAudience, now, ticketLifetime),
	}
	return sign(secret, claims)
}

func registered(audience string, now time.Time, lifetime time.Duration) jwt.RegisteredClaims {
	return jwt.RegisteredClaims{
		Subject: devUser, Audience: jwt.ClaimStrings{audience},
		IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(lifetime)),
	}
}

func sign(secret []byte, claims jwt.Claims) (string, error) {
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	return token, nil
}
