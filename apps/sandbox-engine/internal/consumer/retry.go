package consumer

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const maxDeliveries = 3

// handleFailure leaves a transient failure pending, so reclaim retries it after claimIdle.
// A request the agent rejects, or one that failed maxDeliveries times, ends as a failed status.
func (c *Consumer) handleFailure(ctx context.Context, failed job, cause error) error {
	if !isPermanent(cause) {
		deliveries, err := c.deliveries(ctx, failed.messageID)
		if err != nil {
			return err
		}
		if deliveries < maxDeliveries {
			slog.Warn("sandbox.create will be retried", "attempt", failed.create.AttemptID, "deliveries", deliveries, "error", cause)
			return nil
		}
	}
	return c.fail(ctx, failed, cause)
}

func isPermanent(err error) bool {
	switch status.Code(err) {
	case codes.InvalidArgument, codes.FailedPrecondition, codes.NotFound, codes.PermissionDenied:
		return true
	default:
		return false
	}
}

func (c *Consumer) deliveries(ctx context.Context, messageID string) (int64, error) {
	pending, err := c.redis.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: queue.StreamSandboxCreate, Group: Group, Start: messageID, End: messageID, Count: 1,
	}).Result()
	if err != nil {
		return 0, fmt.Errorf("read deliveries of %s: %w", messageID, err)
	}
	if len(pending) == 0 {
		return 0, nil
	}
	return pending[0].RetryCount, nil
}
