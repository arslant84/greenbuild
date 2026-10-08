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
	"github.com/arslant84/greenbuild/packages/redactlog"
)

// Bounds how long a client may take to send headers, so idle connections cannot pile up.
const readHeaderTimeout = 5 * time.Second

func main() {
	// JSON lines with credentials masked (packages/redactlog); every slog call goes through it.
	slog.SetDefault(redactlog.New(os.Stderr, "sandbox-engine"))
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

	client, release, err := dialAgent(cfg)
	if err != nil {
		return err
	}
	defer release()
	queueConsumer, releaseRedis, err := buildConsumer(cfg, client)
	if err != nil {
		return err
	}
	defer releaseRedis()
	// Activity is tracked in the consumer's Redis; without a consumer there is no idle timeout.
	var activity toucher
	if queueConsumer != nil {
		activity = queueConsumer
	}
	attachHandler, err := buildAttach(cfg, client, activity)
	if err != nil {
		return err
	}
	internalHandler, err := buildInternal(cfg, client, activity)
	if err != nil {
		return err
	}

	server := newServer(cfg.HTTPAddr, routes{attach: attachHandler, internal: internalHandler})
	return runWithConsumer(ctx, queueConsumer, func(ctx context.Context) error {
		return serve(ctx, server, cfg.ShutdownTimeout)
	})
}

// newServer builds the single HTTP server; nil routes are left out.
func newServer(addr string, optional routes) *http.Server {
	mux := http.NewServeMux()
	health.Register(mux)
	if optional.attach != nil {
		mux.Handle("GET /attach", optional.attach)
	}
	if optional.internal != nil {
		mux.Handle("/internal/", optional.internal)
	}
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
