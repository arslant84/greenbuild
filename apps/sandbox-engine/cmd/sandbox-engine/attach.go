package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentpool"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
)

// errNeedsAgent means a feature was enabled but the engine cannot reach an agent over mTLS.
var errNeedsAgent = errors.New("the agent TLS files are not set")

// dialAgents connects to every agent when the TLS files are configured; otherwise the pool is nil.
func dialAgents(cfg config.Config) (*agentpool.Pool, func(), error) {
	if !cfg.Agent.TLS.Enabled() {
		return nil, func() {}, nil
	}
	var clients []*agentclient.Client
	release := func() {
		for _, client := range clients {
			if err := client.Close(); err != nil {
				slog.Warn("close agent client", "error", err)
			}
		}
	}
	var nodes []agentpool.Node
	for _, node := range cfg.Agent.Nodes {
		client, err := agentclient.Dial(agentclient.Options{
			Addr:       node.Addr,
			ServerName: cfg.Agent.ServerName,
			CAFile:     cfg.Agent.TLS.CA,
			CertFile:   cfg.Agent.TLS.Cert,
			KeyFile:    cfg.Agent.TLS.Key,
		})
		if err != nil {
			release()
			return nil, nil, fmt.Errorf("agent client for node %s: %w", node.Name, err)
		}
		clients = append(clients, client)
		nodes = append(nodes, agentpool.Node{Name: node.Name, Agent: client, Slots: cfg.Agent.Slots})
	}
	return agentpool.New(nodes), release, nil
}

// buildAttach returns the /attach handler, or nil when no attach secret is set. Typing counts as
// player activity when activity is not nil.
func buildAttach(cfg config.Config, agents *agentpool.Pool, activity toucher) (http.Handler, error) {
	if cfg.AttachSecret == "" {
		slog.Warn("/attach disabled; set SANDBOX_ENGINE_ATTACH_SECRET and the agent TLS files to enable it")
		return nil, nil
	}
	if agents == nil {
		return nil, fmt.Errorf("/attach: %w", errNeedsAgent)
	}
	verifier, err := attachtoken.NewVerifier([]byte(cfg.AttachSecret))
	if err != nil {
		return nil, fmt.Errorf("attach tokens: %w", err)
	}
	handler := attach.NewHandler(verifier, openThrough(agents), cfg.AllowedOrigins)
	sessions, err := sessionRecordings(cfg)
	if err != nil {
		return nil, err
	}
	var typing attach.StartRecording
	if activity != nil {
		typing = activityRecordings(activity, time.Now)
	}
	handler.RecordSessions(allRecordings(sessions, typing))
	return handler, nil
}

// openThrough adapts the agent pool, whose OpenTerminal returns a concrete type, to attach.
func openThrough(agents *agentpool.Pool) attach.OpenSession {
	return func(ctx context.Context, sandboxID string, size agentclient.TerminalSize) (attach.Session, error) {
		terminal, err := agents.OpenTerminal(ctx, sandboxID, size)
		if err != nil {
			return nil, fmt.Errorf("open terminal: %w", err)
		}
		return terminal, nil
	}
}
