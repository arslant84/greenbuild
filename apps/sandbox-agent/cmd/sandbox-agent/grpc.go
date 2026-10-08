package main

import (
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/agentserver"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/mtls"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// startGRPC serves the agent API over mTLS and returns a function that stops it (within
// cfg.ShutdownTimeout) and the bound address (useful with port 0). Without TLS files the server stays off: the agent API never
// runs unencrypted or unauthenticated.
func startGRPC(cfg config.Config, sandboxes agentserver.Sandboxes) (func(), string, error) {
	if !cfg.TLS.Enabled() {
		slog.Warn("gRPC API disabled; set SANDBOX_AGENT_TLS_CA, SANDBOX_AGENT_TLS_CERT and SANDBOX_AGENT_TLS_KEY to enable it")
		return func() {}, "", nil
	}
	tlsConfig, err := mtls.ServerConfig(mtls.Files{CA: cfg.TLS.CA, Cert: cfg.TLS.Cert, Key: cfg.TLS.Key})
	if err != nil {
		return nil, "", fmt.Errorf("load mTLS config: %w", err)
	}
	listener, err := net.Listen("tcp", cfg.GRPCAddr)
	if err != nil {
		return nil, "", fmt.Errorf("listen on %s: %w", cfg.GRPCAddr, err)
	}

	server := grpc.NewServer(grpc.Creds(credentials.NewTLS(tlsConfig)))
	agentv1.RegisterSandboxAgentServer(server, agentserver.New(sandboxes))
	go func() {
		if err := server.Serve(listener); err != nil {
			slog.Error("gRPC server stopped", "error", err)
		}
	}()
	slog.Info("sandbox-agent gRPC listening", "addr", listener.Addr().String())
	return stopWithin(server, cfg.ShutdownTimeout), listener.Addr().String(), nil
}

// stopWithin stops server gracefully, and forcibly once timeout passes: an open terminal (Exec) stream
// would otherwise keep GracefulStop waiting for as long as its player stays connected.
func stopWithin(server *grpc.Server, timeout time.Duration) func() {
	return func() {
		stopped := make(chan struct{})
		go func() {
			server.GracefulStop()
			close(stopped)
		}()
		select {
		case <-stopped:
		case <-time.After(timeout):
			slog.Warn("gRPC graceful stop timed out; closing open streams", "timeout", timeout)
			server.Stop()
			<-stopped
		}
	}
}
