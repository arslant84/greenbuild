// Command sandbox-engine is the control plane: it reads the queue, proxies terminals and runs checks.
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

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/health"
)

// Bounds how long a client may take to send headers, so idle connections cannot pile up.
const readHeaderTimeout = 5 * time.Second

func main() {
	if err := run(); err != nil {
		slog.Error("sandbox-engine stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return serve(ctx, newServer(cfg.HTTPAddr), cfg.ShutdownTimeout)
}

// newServer builds the single HTTP server; /attach and /internal routes join health here later.
func newServer(addr string) *http.Server {
	mux := http.NewServeMux()
	health.Register(mux)
	return &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: readHeaderTimeout}
}

// serve runs server until ctx is cancelled, then shuts it down gracefully.
func serve(ctx context.Context, server *http.Server, shutdownTimeout time.Duration) error {
	serveErr := make(chan error, 1)
	go func() {
		serveErr <- server.ListenAndServe()
	}()
	slog.Info("sandbox-engine listening", "addr", server.Addr)

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
