// Package consumer reads sandbox.create from Redis Streams, starts the sandbox through the agent
// and reports the outcome on sandbox.status.
package consumer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

// Group is the consumer group every engine instance joins, so each message goes to one engine.
const Group = "sandbox-engine"

const (
	readBlock  = 5 * time.Second
	batchSize  = 10
	retryDelay = time.Second
)

// Agent is the part of the agent client the consumer needs.
type Agent interface {
	CreateSandbox(ctx context.Context, req *agentv1.CreateSandboxRequest) (string, error)
}

// Options configures a Consumer. Name must be unique per engine instance.
type Options struct {
	Redis redis.Cmdable
	Agent Agent
	Codec *queue.Codec
	Name  string
}

// Consumer handles sandbox.create messages one at a time.
type Consumer struct {
	redis redis.Cmdable
	agent Agent
	codec *queue.Codec
	name  string
}

// New returns a Consumer; call Run to start it.
func New(opts Options) *Consumer {
	return &Consumer{redis: opts.Redis, agent: opts.Agent, codec: opts.Codec, name: opts.Name}
}

// Run consumes until ctx is cancelled. Redis errors are logged and retried, not returned,
// so a Redis restart does not stop the engine.
func (c *Consumer) Run(ctx context.Context) error {
	if err := c.ensureGroup(ctx); err != nil {
		return err
	}
	for ctx.Err() == nil {
		if err := c.poll(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("read sandbox.create", "error", err)
			wait(ctx, retryDelay)
		}
	}
	return nil
}

func (c *Consumer) ensureGroup(ctx context.Context) error {
	err := c.redis.XGroupCreateMkStream(ctx, queue.StreamSandboxCreate, Group, "0").Err()
	if err != nil && !strings.HasPrefix(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("create group %s on %s: %w", Group, queue.StreamSandboxCreate, err)
	}
	return nil
}

func (c *Consumer) poll(ctx context.Context) error {
	streams, err := c.redis.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group: Group, Consumer: c.name, Streams: []string{queue.StreamSandboxCreate, ">"},
		Count: batchSize, Block: readBlock,
	}).Result()
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read %s: %w", queue.StreamSandboxCreate, err)
	}
	for _, stream := range streams {
		if err := c.handleAll(ctx, stream.Messages); err != nil {
			return err
		}
	}
	return nil
}

func (c *Consumer) handleAll(ctx context.Context, messages []redis.XMessage) error {
	for _, message := range messages {
		if err := c.handle(ctx, message); err != nil {
			return err
		}
	}
	return nil
}

func wait(ctx context.Context, delay time.Duration) {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}
