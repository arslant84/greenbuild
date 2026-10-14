package main

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentpool"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/check"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/internalauth"
)

var errNeedsChallengesDir = errors.New("SANDBOX_ENGINE_CHALLENGES_DIR is not set")

// buildInternal returns the /internal routes behind the internal token, or nil when no token is set.
// A check counts as player activity when activity is not nil.
func buildInternal(cfg config.Config, agents *agentpool.Pool, activity toucher) (http.Handler, error) {
	if cfg.InternalToken == "" {
		slog.Warn("/internal disabled; set SANDBOX_ENGINE_INTERNAL_TOKEN to enable checks")
		return nil, nil
	}
	if agents == nil {
		return nil, fmt.Errorf("/internal: %w", errNeedsAgent)
	}
	if cfg.ChallengesDir == "" {
		return nil, fmt.Errorf("/internal: %w", errNeedsChallengesDir)
	}
	checkHandler := check.Handler(check.NewChecker(agents, cfg.ChallengesDir))
	if activity != nil {
		checkHandler = touchingChecks(activity, checkHandler)
	}
	mux := http.NewServeMux()
	mux.Handle("POST /internal/attempts/{id}/check", checkHandler)
	return internalauth.Require(cfg.InternalToken, mux), nil
}

// routes are the optional handlers next to /health; nil means the feature is off.
type routes struct {
	attach   http.Handler
	internal http.Handler
}
