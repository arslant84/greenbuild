// Command sandbox-agent runs on each sandbox node and manages sandbox containers.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/agentserver"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/health"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	"github.com/arslant84/greenbuild/packages/redactlog"
	"github.com/moby/moby/client"
)

// reapInterval bounds how long past its deadline a sandbox can survive.
const reapInterval = 10 * time.Second

// cpuWatchInterval is how often sandboxes' CPU usage is sampled; a busy one goes after about a minute.
const cpuWatchInterval = 10 * time.Second

func main() {
	// JSON lines with credentials masked (packages/redactlog); every slog call goes through it.
	slog.SetDefault(redactlog.New(os.Stderr, "sandbox-agent"))
	if err := run(); err != nil {
		slog.Error("sandbox-agent stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}
	if cfg.Runtime != config.RuntimeGVisor {
		slog.Warn("sandboxes run without gVisor; use only for local development", "runtime", cfg.Runtime)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	docker, err := client.New(client.FromEnv)
	if err != nil {
		return fmt.Errorf("create docker client: %w", err)
	}
	defer closeDocker(docker)
	manager := sandbox.NewManager(docker, cfg.Runtime)
	go manager.RunReaper(ctx, reapInterval)
	go sandbox.NewCPUWatch(manager).Run(ctx, cpuWatchInterval)

	stopGRPC, _, err := startGRPC(cfg, agentserver.FromManager(manager))
	if err != nil {
		return err
	}
	defer stopGRPC()

	return serve(ctx, health.NewServer(cfg.HealthAddr), cfg.ShutdownTimeout)
}

func closeDocker(docker *client.Client) {
	if err := docker.Close(); err != nil {
		slog.Warn("close docker client", "error", err)
	}
}

// serve runs server until ctx is cancelled, then shuts it down gracefully.
func serve(ctx context.Context, server *http.Server, shutdownTimeout time.Duration) error {
	serveErr := make(chan error, 1)
	go func() {
		serveErr <- server.ListenAndServe()
	}()
	slog.Info("sandbox-agent listening", "addr", server.Addr)

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve %s: %w", server.Addr, err)
	case <-ctx.Done():
	}

	// A fresh context: the parent one is already cancelled.
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shut down %s: %w", server.Addr, err)
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve %s: %w", server.Addr, err)
	}
	return nil
}
