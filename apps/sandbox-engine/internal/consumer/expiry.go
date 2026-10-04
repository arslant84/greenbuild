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

// DeadlinesKey and IdleDeadlinesKey are sorted sets of attempt ids, scored by the Unix second
// their time limit ends and the second they count as idle. AbandonRequestsKey holds attempts the
// API asked to destroy, due at once, so the same loop destroys and reports them.
const (
	DeadlinesKey       = "engine:deadlines"
	IdleDeadlinesKey   = "engine:idle-deadlines"
	AbandonRequestsKey = "engine:abandon-requests"
)

// deadlineSet is one way a sandbox runs out, and the reason reported when it does.
type deadlineSet struct {
	key    string
	reason string
}

// The player's own request is reported first when several deadlines are due at once.
var deadlineSets = []deadlineSet{
	{AbandonRequestsKey, queue.ReasonAbandoned},
	{DeadlinesKey, queue.ReasonExpired},
	{IdleDeadlinesKey, queue.ReasonIdle},
}

const (
	expiryInterval   = 10 * time.Second
	expiryRetryDelay = 30 * time.Second
	expiryBatch      = 100
)

// scheduleDeadlines records when the attempt's sandbox must go. NX keeps the first deadlines, so
// a redelivered sandbox.create cannot extend them.
func (c *Consumer) scheduleDeadlines(ctx context.Context, create queue.SandboxCreate) error {
	now := c.now()
	if err := c.schedule(ctx, DeadlinesKey, create.AttemptID, now.Add(time.Duration(create.TTLSeconds)*time.Second)); err != nil {
		return err
	}
	if c.idleTimeout == 0 {
		return nil
	}
	return c.schedule(ctx, IdleDeadlinesKey, create.AttemptID, now.Add(c.idleTimeout))
}

func (c *Consumer) schedule(ctx context.Context, key, attemptID string, at time.Time) error {
	if err := c.redis.ZAddNX(ctx, key, redis.Z{Score: float64(at.Unix()), Member: attemptID}).Err(); err != nil {
		return fmt.Errorf("schedule %s for attempt %s: %w", key, attemptID, err)
	}
	return nil
}

// Touch records player activity: the sandbox counts as idle only idleTimeout after the last one.
// XX updates attempts that still have a sandbox and never adds an unknown attempt.
func (c *Consumer) Touch(ctx context.Context, attemptID string) error {
	if c.idleTimeout == 0 {
		return nil
	}
	idleAt := c.now().Add(c.idleTimeout)
	if err := c.redis.ZAddXX(ctx, IdleDeadlinesKey, redis.Z{Score: float64(idleAt.Unix()), Member: attemptID}).Err(); err != nil {
		return fmt.Errorf("record activity of attempt %s: %w", attemptID, err)
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

// expireDue destroys every sandbox past a deadline and tells the API with a destroyed status.
// The agent's own reaper removes sandboxes later as a backstop, but only the engine tells the API.
func (c *Consumer) expireDue(ctx context.Context) error {
	for _, set := range deadlineSets {
		attemptIDs, err := c.redis.ZRangeByScore(ctx, set.key, &redis.ZRangeBy{
			Min: "-inf", Max: strconv.FormatInt(c.now().Unix(), 10), Count: expiryBatch,
		}).Result()
		if err != nil {
			return fmt.Errorf("read %s: %w", set.key, err)
		}
		for _, attemptID := range attemptIDs {
			if err := c.expire(ctx, set, attemptID); err != nil {
				return err
			}
		}
	}
	return nil
}

// expire removes the deadline first to claim it, so two engines never expire the same attempt,
// and drops the attempt's other deadline so it is reported once; anything that fails afterwards
// puts the claimed deadline back for a later try.
func (c *Consumer) expire(ctx context.Context, set deadlineSet, attemptID string) error {
	claimed, err := c.redis.ZRem(ctx, set.key, attemptID).Result()
	if err != nil {
		return fmt.Errorf("claim %s of attempt %s: %w", set.key, attemptID, err)
	}
	if claimed == 0 {
		return nil
	}
	if err := c.dropDeadlines(ctx, attemptID); err != nil {
		return errors.Join(err, c.retryLater(ctx, set, attemptID))
	}
	sandboxID, err := c.redis.Get(ctx, AttemptSandboxKey(attemptID)).Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return errors.Join(fmt.Errorf("read sandbox of attempt %s: %w", attemptID, err), c.retryLater(ctx, set, attemptID))
	}
	if sandboxID != "" {
		if err := c.agent.Destroy(ctx, sandboxID); err != nil && status.Code(err) != codes.NotFound {
			slog.Warn("destroy sandbox; will retry", "attempt", attemptID, "reason", set.reason, "error", err)
			return c.retryLater(ctx, set, attemptID)
		}
	}
	err = c.publish(ctx, queue.SandboxStatus{
		Version: queue.Version, AttemptID: attemptID, Status: queue.StatusDestroyed, SandboxID: sandboxID, Reason: set.reason,
	})
	if err != nil {
		return errors.Join(err, c.retryLater(ctx, set, attemptID))
	}
	return nil
}

func (c *Consumer) dropDeadlines(ctx context.Context, attemptID string) error {
	for _, set := range deadlineSets {
		if err := c.redis.ZRem(ctx, set.key, attemptID).Err(); err != nil {
			return fmt.Errorf("drop %s of attempt %s: %w", set.key, attemptID, err)
		}
	}
	return nil
}

func (c *Consumer) retryLater(ctx context.Context, set deadlineSet, attemptID string) error {
	retryAt := c.now().Add(expiryRetryDelay)
	if err := c.redis.ZAdd(ctx, set.key, redis.Z{Score: float64(retryAt.Unix()), Member: attemptID}).Err(); err != nil {
		return fmt.Errorf("reschedule %s of attempt %s: %w", set.key, attemptID, err)
	}
	return nil
}
