package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
)

// errAttachNeedsAgent means /attach was enabled but the engine cannot reach an agent over mTLS.
var errAttachNeedsAgent = errors.New("SANDBOX_ENGINE_ATTACH_SECRET is set but the agent TLS files are not")

// buildAttach returns the /attach handler and a function that releases its agent connection.
// Without an attach secret the endpoint stays off (nil handler).
func buildAttach(cfg config.Config) (http.Handler, func(), error) {
	if cfg.AttachSecret == "" {
		slog.Warn("/attach disabled; set SANDBOX_ENGINE_ATTACH_SECRET and the agent TLS files to enable it")
		return nil, func() {}, nil
	}
	if !cfg.Agent.TLS.Enabled() {
		return nil, nil, errAttachNeedsAgent
	}
	verifier, err := attachtoken.NewVerifier([]byte(cfg.AttachSecret))
	if err != nil {
		return nil, nil, fmt.Errorf("attach tokens: %w", err)
	}
	client, err := agentclient.Dial(agentclient.Options{
		Addr:       cfg.Agent.Addr,
		ServerName: cfg.Agent.ServerName,
		CAFile:     cfg.Agent.TLS.CA,
		CertFile:   cfg.Agent.TLS.Cert,
		KeyFile:    cfg.Agent.TLS.Key,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("agent client: %w", err)
	}
	release := func() {
		if err := client.Close(); err != nil {
			slog.Warn("close agent client", "error", err)
		}
	}
	return attach.NewHandler(verifier, openThrough(client), cfg.AllowedOrigins), release, nil
}

// openThrough adapts the agent client, whose OpenTerminal returns a concrete type, to attach.
func openThrough(client *agentclient.Client) attach.OpenSession {
	return func(ctx context.Context, sandboxID string, size agentclient.TerminalSize) (attach.Session, error) {
		terminal, err := client.OpenTerminal(ctx, sandboxID, size)
		if err != nil {
			return nil, fmt.Errorf("open terminal: %w", err)
		}
		return terminal, nil
	}
}
