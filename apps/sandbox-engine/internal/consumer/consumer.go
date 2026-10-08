// Package consumer reads sandbox.create and sandbox.destroy from Redis Streams, starts and
// destroys sandboxes through the agent and reports the outcome on sandbox.status.
package consumer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

// Group is the consumer group every engine instance joins, so each message goes to one engine.
const Group = "sandbox-engine"

// streams are read together; a message is handled by the function for its stream.
var streams = []string{queue.StreamSandboxCreate, queue.StreamSandboxDestroy}

const (
	readBlock  = 5 * time.Second
	batchSize  = 10
	claimIdle  = 30 * time.Second
	retryDelay = time.Second
)

// Agent is the part of the agent client the consumer needs.
type Agent interface {
	CreateSandbox(ctx context.Context, req *agentv1.CreateSandboxRequest) (string, error)
	Destroy(ctx context.Context, sandboxID string) error
	TakeDestroyed(ctx context.Context) ([]agentclient.Destroyed, error)
}

// Options configures a Consumer. Name must be unique per engine instance. Now defaults to time.Now.
// IdleTimeout destroys a sandbox that long after its last Touch; zero turns idle expiry off.
type Options struct {
	Redis       redis.Cmdable
	Agent       Agent
	Codec       *queue.Codec
	Name        string
	Now         func() time.Time
	IdleTimeout time.Duration
}

// Consumer handles sandbox.create messages one at a time.
type Consumer struct {
	redis redis.Cmdable
	agent Agent
	codec *queue.Codec
	name  string
	now   func() time.Time
	// idleTimeout is zero when idle expiry is off.
	idleTimeout time.Duration
}

// New returns a Consumer; call Run to start it.
func New(opts Options) *Consumer {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	return &Consumer{redis: opts.Redis, agent: opts.Agent, codec: opts.Codec, name: opts.Name, now: now, idleTimeout: opts.IdleTimeout}
}

// Run consumes until ctx is cancelled, and destroys sandboxes whose time ran out meanwhile.
// Redis errors are logged and retried, not returned, so a Redis restart does not stop the engine.
func (c *Consumer) Run(ctx context.Context) error {
	if err := c.ensureGroup(ctx); err != nil {
		return err
	}
	expiryDone := make(chan struct{})
	go func() {
		defer close(expiryDone)
		c.expireLoop(ctx)
	}()
	defer func() { <-expiryDone }()
	for ctx.Err() == nil {
		if err := c.poll(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("read sandbox.create", "error", err)
			wait(ctx, retryDelay)
		}
	}
	return nil
}

func (c *Consumer) ensureGroup(ctx context.Context) error {
	for _, stream := range streams {
		err := c.redis.XGroupCreateMkStream(ctx, stream, Group, "0").Err()
		if err != nil && !strings.HasPrefix(err.Error(), "BUSYGROUP") {
			return fmt.Errorf("create group %s on %s: %w", Group, stream, err)
		}
	}
	return nil
}

func (c *Consumer) poll(ctx context.Context) error {
	if err := c.reclaim(ctx); err != nil {
		return err
	}
	return c.readNew(ctx)
}

// reclaim takes over messages left pending by a failed try or by an engine that crashed.
func (c *Consumer) reclaim(ctx context.Context) error {
	for _, stream := range streams {
		messages, _, err := c.redis.XAutoClaim(ctx, &redis.XAutoClaimArgs{
			Stream: stream, Group: Group, Consumer: c.name,
			MinIdle: claimIdle, Start: "0-0", Count: batchSize,
		}).Result()
		if err != nil {
			return fmt.Errorf("claim pending %s: %w", stream, err)
		}
		if err := c.handleAll(ctx, stream, messages); err != nil {
			return err
		}
	}
	return nil
}

func (c *Consumer) readNew(ctx context.Context) error {
	read, err := c.redis.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group: Group, Consumer: c.name, Streams: []string{queue.StreamSandboxCreate, queue.StreamSandboxDestroy, ">", ">"},
		Count: batchSize, Block: readBlock,
	}).Result()
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read %v: %w", streams, err)
	}
	for _, stream := range read {
		if err := c.handleAll(ctx, stream.Stream, stream.Messages); err != nil {
			return err
		}
	}
	return nil
}

func (c *Consumer) handleAll(ctx context.Context, stream string, messages []redis.XMessage) error {
	handle := c.handle
	if stream == queue.StreamSandboxDestroy {
		handle = c.handleDestroy
	}
	for _, message := range messages {
		if err := handle(ctx, message); err != nil {
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
