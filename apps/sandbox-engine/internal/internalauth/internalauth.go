// Package internalauth protects the engine's /internal routes: only a caller holding the shared
// internal token (the API) may use them.
package internalauth

import (
	"crypto/subtle"
	"log/slog"
	"net/http"
)

// Require passes a request to next only with "Authorization: Bearer <token>". The comparison is
// constant-time so the token cannot be guessed byte by byte from response timings; an empty
// token refuses everything rather than letting everyone in.
func Require(token string, next http.Handler) http.Handler {
	expected := []byte("Bearer " + token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		presented := []byte(r.Header.Get("Authorization"))
		if token == "" || subtle.ConstantTimeCompare(presented, expected) != 1 {
			slog.Warn("internal request refused", "path", r.URL.Path)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
