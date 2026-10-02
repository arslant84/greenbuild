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

// errNeedsAgent means a feature was enabled but the engine cannot reach an agent over mTLS.
var errNeedsAgent = errors.New("the agent TLS files are not set")

// dialAgent connects to the agent when its TLS files are configured; otherwise the client is nil.
func dialAgent(cfg config.Config) (*agentclient.Client, func(), error) {
	if !cfg.Agent.TLS.Enabled() {
		return nil, func() {}, nil
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
	return client, release, nil
}

// buildAttach returns the /attach handler, or nil when no attach secret is set.
func buildAttach(cfg config.Config, client *agentclient.Client) (http.Handler, error) {
	if cfg.AttachSecret == "" {
		slog.Warn("/attach disabled; set SANDBOX_ENGINE_ATTACH_SECRET and the agent TLS files to enable it")
		return nil, nil
	}
	if client == nil {
		return nil, fmt.Errorf("/attach: %w", errNeedsAgent)
	}
	verifier, err := attachtoken.NewVerifier([]byte(cfg.AttachSecret))
	if err != nil {
		return nil, fmt.Errorf("attach tokens: %w", err)
	}
	handler := attach.NewHandler(verifier, openThrough(client), cfg.AllowedOrigins)
	if err := recordSessions(cfg, handler); err != nil {
		return nil, err
	}
	return handler, nil
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
