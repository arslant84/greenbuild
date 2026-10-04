package consumer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// DeadlinesKey is a sorted set of attempt ids, scored by the Unix second their time limit ends.
const DeadlinesKey = "engine:deadlines"

const (
	expiryInterval   = 10 * time.Second
	expiryRetryDelay = 30 * time.Second
	expiryBatch      = 100
)

// scheduleExpiry records when the attempt's sandbox must go. NX keeps the first deadline, so a
// redelivered sandbox.create cannot extend the time limit.
func (c *Consumer) scheduleExpiry(ctx context.Context, create queue.SandboxCreate) error {
	deadline := c.now().Add(time.Duration(create.TTLSeconds) * time.Second)
	err := c.redis.ZAddNX(ctx, DeadlinesKey, redis.Z{Score: float64(deadline.Unix()), Member: create.AttemptID}).Err()
	if err != nil {
		return fmt.Errorf("schedule expiry of attempt %s: %w", create.AttemptID, err)
	}
	return nil
}

func (c *Consumer) expireLoop(ctx context.Context) {
	for ctx.Err() == nil {
		if err := c.expireDue(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("expire sandboxes", "error", err)
		}
		wait(ctx, expiryInterval)
	}
}

// expireDue destroys every sandbox past its deadline and tells the API with a destroyed status.
// The agent's own reaper removes sandboxes later as a backstop, but only the engine tells the API.
func (c *Consumer) expireDue(ctx context.Context) error {
	attemptIDs, err := c.redis.ZRangeByScore(ctx, DeadlinesKey, &redis.ZRangeBy{
		Min: "-inf", Max: strconv.FormatInt(c.now().Unix(), 10), Count: expiryBatch,
	}).Result()
	if err != nil {
		return fmt.Errorf("read %s: %w", DeadlinesKey, err)
	}
	for _, attemptID := range attemptIDs {
		if err := c.expire(ctx, attemptID); err != nil {
			return err
		}
	}
	return nil
}

// expire removes the deadline first to claim it, so two engines never expire the same attempt;
// anything that fails afterwards puts the deadline back for a later try.
func (c *Consumer) expire(ctx context.Context, attemptID string) error {
	claimed, err := c.redis.ZRem(ctx, DeadlinesKey, attemptID).Result()
	if err != nil {
		return fmt.Errorf("claim expiry of attempt %s: %w", attemptID, err)
	}
	if claimed == 0 {
		return nil
	}
	sandboxID, err := c.redis.Get(ctx, AttemptSandboxKey(attemptID)).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return errors.Join(fmt.Errorf("read sandbox of attempt %s: %w", attemptID, err), c.retryLater(ctx, attemptID))
	}
	if sandboxID != "" {
		if err := c.agent.Destroy(ctx, sandboxID); err != nil && status.Code(err) != codes.NotFound {
			slog.Warn("destroy expired sandbox; will retry", "attempt", attemptID, "error", err)
			return c.retryLater(ctx, attemptID)
		}
	}
	err = c.publish(ctx, queue.SandboxStatus{
		Version: queue.Version, AttemptID: attemptID, Status: queue.StatusDestroyed, SandboxID: sandboxID, Reason: queue.ReasonExpired,
	})
	if err != nil {
		return errors.Join(err, c.retryLater(ctx, attemptID))
	}
	return nil
}

func (c *Consumer) retryLater(ctx context.Context, attemptID string) error {
	retryAt := c.now().Add(expiryRetryDelay)
	if err := c.redis.ZAdd(ctx, DeadlinesKey, redis.Z{Score: float64(retryAt.Unix()), Member: attemptID}).Err(); err != nil {
		return fmt.Errorf("reschedule expiry of attempt %s: %w", attemptID, err)
	}
	return nil
}
