package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/consumer"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

// buildConsumer returns the sandbox.create consumer and a release for its Redis client,
// or a nil consumer when no Redis URL is set.
func buildConsumer(cfg config.Config, client *agentclient.Client) (*consumer.Consumer, func(), error) {
	if cfg.Redis == nil {
		slog.Warn("queue consumer disabled; set SANDBOX_ENGINE_REDIS_URL to start sandboxes from sandbox.create")
		return nil, func() {}, nil
	}
	if client == nil {
		return nil, nil, fmt.Errorf("queue consumer: %w", errNeedsAgent)
	}
	codec, err := queue.NewCodec()
	if err != nil {
		return nil, nil, fmt.Errorf("queue consumer: %w", err)
	}
	// The pod name in Kubernetes, so pending messages show which engine holds them.
	name, err := os.Hostname()
	if err != nil {
		return nil, nil, fmt.Errorf("queue consumer name: %w", err)
	}
	redisClient := redis.NewClient(cfg.Redis)
	release := func() {
		if err := redisClient.Close(); err != nil {
			slog.Warn("close redis client", "error", err)
		}
	}
	return consumer.New(consumer.Options{Redis: redisClient, Agent: client, Codec: codec, Name: name}), release, nil
}

// runWithConsumer serves HTTP and consumes the queue together; when either one stops, both stop.
func runWithConsumer(ctx context.Context, queueConsumer *consumer.Consumer, serveHTTP func(context.Context) error) error {
	if queueConsumer == nil {
		return serveHTTP(ctx)
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	consumed := make(chan error, 1)
	go func() {
		consumed <- queueConsumer.Run(ctx)
		cancel()
	}()
	served := serveHTTP(ctx)
	cancel()
	return errors.Join(served, <-consumed)
}
