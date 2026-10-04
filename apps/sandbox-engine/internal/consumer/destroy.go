package consumer

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

// handleDestroy queues the attempt for the expiry loop, which destroys its sandbox and reports
// destroyed with the reason. A repeated request only repeats that status, which the API ignores.
func (c *Consumer) handleDestroy(ctx context.Context, message redis.XMessage) error {
	request, err := c.decodeDestroy(message)
	if err != nil {
		slog.Warn("drop invalid sandbox.destroy", "message", message.ID, "error", err)
		return c.ack(ctx, queue.StreamSandboxDestroy, message.ID)
	}
	if err := c.schedule(ctx, AbandonRequestsKey, request.AttemptID, c.now()); err != nil {
		return err
	}
	return c.ack(ctx, queue.StreamSandboxDestroy, message.ID)
}

func (c *Consumer) decodeDestroy(message redis.XMessage) (queue.SandboxDestroy, error) {
	payload, ok := message.Values[queue.PayloadField].(string)
	if !ok {
		return queue.SandboxDestroy{}, fmt.Errorf("%w: no %s field", queue.ErrInvalidMessage, queue.PayloadField)
	}
	request, err := c.codec.DecodeSandboxDestroy([]byte(payload))
	if err != nil {
		return queue.SandboxDestroy{}, fmt.Errorf("decode %s: %w", queue.StreamSandboxDestroy, err)
	}
	return request, nil
}
