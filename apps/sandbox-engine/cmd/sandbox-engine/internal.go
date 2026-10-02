package main

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/check"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/internalauth"
)

var errNeedsChallengesDir = errors.New("SANDBOX_ENGINE_CHALLENGES_DIR is not set")

// buildInternal returns the /internal routes behind the internal token, or nil when no token is set.
func buildInternal(cfg config.Config, client *agentclient.Client) (http.Handler, error) {
	if cfg.InternalToken == "" {
		slog.Warn("/internal disabled; set SANDBOX_ENGINE_INTERNAL_TOKEN to enable checks")
		return nil, nil
	}
	if client == nil {
		return nil, fmt.Errorf("/internal: %w", errNeedsAgent)
	}
	if cfg.ChallengesDir == "" {
		return nil, fmt.Errorf("/internal: %w", errNeedsChallengesDir)
	}
	mux := http.NewServeMux()
	mux.Handle("POST /internal/attempts/{id}/check", check.Handler(check.NewChecker(client, cfg.ChallengesDir)))
	return internalauth.Require(cfg.InternalToken, mux), nil
}

// routes are the optional handlers next to /health; nil means the feature is off.
type routes struct {
	attach   http.Handler
	internal http.Handler
}
