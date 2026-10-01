// Package health serves the engine liveness probe.
package health

import (
	"log/slog"
	"net/http"
)

var okBody = []byte(`{"status":"ok"}`)

// Register adds GET /health to mux. Public on purpose: container probes call it without credentials.
func Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", handleHealth)
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(okBody); err != nil {
		// The client went away; there is nobody left to report the error to.
		slog.Warn("write health response", "error", err)
	}
}
