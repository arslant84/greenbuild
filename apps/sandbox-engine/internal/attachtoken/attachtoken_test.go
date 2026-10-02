package attachtoken

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	testSecret = []byte(strings.Repeat("s", MinSecretBytes))
	issuedAt   = time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)
)

func validClaims() Claims {
	return Claims{
		SandboxID: "sbx-1",
		AttemptID: "att-1",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			Audience:  jwt.ClaimStrings{Audience},
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ExpiresAt: jwt.NewNumericDate(issuedAt.Add(MaxLifetime)),
		},
	}
}

func sign(t *testing.T, method jwt.SigningMethod, key any, claims Claims) string {
	t.Helper()
	token, err := jwt.NewWithClaims(method, claims).SignedString(key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return token
}

func verifierAt(t *testing.T, now time.Time) *Verifier {
	t.Helper()
	verifier, err := NewVerifier(testSecret)
	if err != nil {
		t.Fatalf("NewVerifier() error = %v", err)
	}
	verifier.now = func() time.Time { return now }
	return verifier
}

func TestVerifyAcceptsAValidToken(t *testing.T) {
	token := sign(t, jwt.SigningMethodHS256, testSecret, validClaims())

	attach, err := verifierAt(t, issuedAt.Add(10*time.Second)).Verify(token)
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if attach != (Attach{SandboxID: "sbx-1", AttemptID: "att-1", UserID: "user-1"}) {
		t.Errorf("Verify() = %+v", attach)
	}
}

func TestVerifyRejectsBadTokens(t *testing.T) {
	change := func(edit func(*Claims)) Claims {
		claims := validClaims()
		edit(&claims)
		return claims
	}
	cases := map[string]string{
		"wrong secret":    sign(t, jwt.SigningMethodHS256, []byte(strings.Repeat("x", MinSecretBytes)), validClaims()),
		"other HMAC alg":  sign(t, jwt.SigningMethodHS512, testSecret, validClaims()),
		"alg none":        sign(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, validClaims()),
		"other audience":  sign(t, jwt.SigningMethodHS256, testSecret, change(func(c *Claims) { c.Audience = jwt.ClaimStrings{"api"} })),
		"no sandbox":      sign(t, jwt.SigningMethodHS256, testSecret, change(func(c *Claims) { c.SandboxID = "" })),
		"no user":         sign(t, jwt.SigningMethodHS256, testSecret, change(func(c *Claims) { c.Subject = "" })),
		"no expiry":       sign(t, jwt.SigningMethodHS256, testSecret, change(func(c *Claims) { c.ExpiresAt = nil })),
		"no issued-at":    sign(t, jwt.SigningMethodHS256, testSecret, change(func(c *Claims) { c.IssuedAt = nil })),
		"lives too long":  sign(t, jwt.SigningMethodHS256, testSecret, change(func(c *Claims) { c.ExpiresAt = jwt.NewNumericDate(issuedAt.Add(time.Hour)) })),
		"not a token":     "not.a.jwt",
		"tampered claims": tamper(sign(t, jwt.SigningMethodHS256, testSecret, validClaims())),
	}
	verifier := verifierAt(t, issuedAt.Add(10*time.Second))
	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := verifier.Verify(token); !errors.Is(err, ErrInvalidToken) {
				t.Errorf("Verify() error = %v, want ErrInvalidToken", err)
			}
		})
	}
}

func TestVerifyRejectsAnExpiredToken(t *testing.T) {
	token := sign(t, jwt.SigningMethodHS256, testSecret, validClaims())

	if _, err := verifierAt(t, issuedAt.Add(MaxLifetime+clockSkew+time.Second)).Verify(token); !errors.Is(err, ErrInvalidToken) {
		t.Errorf("Verify() error = %v, want ErrInvalidToken after expiry", err)
	}
}

func TestNewVerifierRejectsShortSecrets(t *testing.T) {
	if _, err := NewVerifier([]byte("short")); !errors.Is(err, ErrWeakSecret) {
		t.Errorf("NewVerifier() error = %v, want ErrWeakSecret", err)
	}
}

// tamper swaps the payload for one naming another sandbox, keeping the original signature.
func tamper(token string) string {
	parts := strings.Split(token, ".")
	other := strings.Split(jwtWithSandbox("sbx-OTHER"), ".")
	return parts[0] + "." + other[1] + "." + parts[2]
}

func jwtWithSandbox(sandboxID string) string {
	claims := validClaims()
	claims.SandboxID = sandboxID
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(testSecret)
	return token
}
