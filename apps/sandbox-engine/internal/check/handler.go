package check

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
)

const maxRequestBytes = 4 << 10

// request is the API's call; sandbox_id travels with it until the engine tracks attempts itself.
type request struct {
	SandboxID   string `json:"sandbox_id"`
	ChallengeID string `json:"challenge_id"`
}

// errorBody follows the API's {code, message} error format.
type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Handler serves POST /internal/attempts/{id}/check. It must be wrapped in internalauth.Require.
func Handler(checker *Checker) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBytes)).Decode(&req); err != nil || req.SandboxID == "" {
			writeJSON(w, http.StatusBadRequest, errorBody{Code: "validation_failed", Message: "sandbox_id and challenge_id are required"})
			return
		}
		result, err := checker.Run(r.Context(), req.SandboxID, req.ChallengeID)
		if errors.Is(err, ErrUnknownChallenge) {
			writeJSON(w, http.StatusNotFound, errorBody{Code: "not_found", Message: "unknown challenge"})
			return
		}
		if err != nil {
			slog.Error("check failed", "attempt", r.PathValue("id"), "sandbox", req.SandboxID, "error", err)
			writeJSON(w, http.StatusInternalServerError, errorBody{Code: "internal", Message: "check could not run"})
			return
		}
		writeJSON(w, http.StatusOK, result)
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Warn("write response", "error", err)
	}
}
