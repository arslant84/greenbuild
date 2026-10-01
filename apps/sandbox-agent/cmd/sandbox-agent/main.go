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

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/health"
)

func main() {
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

	return serve(ctx, health.NewServer(cfg.HealthAddr), cfg.ShutdownTimeout)
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
