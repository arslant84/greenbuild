// Package health serves the agent liveness probe.
package health

import (
	"log/slog"
	"net/http"
	"time"
)

// Bounds how long a client may take to send headers, so idle connections cannot pile up.
const readHeaderTimeout = 5 * time.Second

var okBody = []byte(`{"status":"ok"}`)

// NewServer returns an HTTP server that answers GET /health on addr.
func NewServer(addr string) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           Handler(),
		ReadHeaderTimeout: readHeaderTimeout,
	}
}

// Handler routes GET /health; every other path or method is rejected by the mux.
func Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(okBody); err != nil {
		// The client went away; there is nobody left to report the error to.
		slog.Warn("write health response", "error", err)
	}
}
