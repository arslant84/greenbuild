package consumer

import (
	"context"
	"fmt"
	"log/slog"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/status"
)

const statusStreamMaxLen = 100_000

// job is one sandbox.create message being handled.
type job struct {
	messageID string
	create    queue.SandboxCreate
}

// handle returns an error only when Redis fails; agent failures become a failed status.
func (c *Consumer) handle(ctx context.Context, message redis.XMessage) error {
	create, err := c.decode(message)
	if err != nil {
		// Redelivering cannot fix a malformed message, and without a valid attempt id there is no one to tell.
		slog.Warn("drop invalid sandbox.create", "message", message.ID, "error", err)
		return c.ack(ctx, message.ID)
	}
	sandboxID, err := c.agent.CreateSandbox(ctx, createRequest(create))
	if err != nil {
		return c.fail(ctx, job{messageID: message.ID, create: create}, err)
	}
	return c.finish(ctx, message.ID, queue.SandboxStatus{
		Version: queue.Version, AttemptID: create.AttemptID, Status: queue.StatusReady, SandboxID: sandboxID,
	})
}

func (c *Consumer) decode(message redis.XMessage) (queue.SandboxCreate, error) {
	payload, ok := message.Values[queue.PayloadField].(string)
	if !ok {
		return queue.SandboxCreate{}, fmt.Errorf("%w: no %s field", queue.ErrInvalidMessage, queue.PayloadField)
	}
	create, err := c.codec.DecodeSandboxCreate([]byte(payload))
	if err != nil {
		return queue.SandboxCreate{}, fmt.Errorf("decode %s: %w", queue.StreamSandboxCreate, err)
	}
	return create, nil
}

// The challenge's setup.sh starts its services; the container's own process only keeps it alive.
func createRequest(create queue.SandboxCreate) *agentv1.CreateSandboxRequest {
	seed := create.Seed
	return &agentv1.CreateSandboxRequest{
		Image: create.Image, Command: []string{"sleep", "infinity"},
		CpuMillis: create.CPUMillis, MemoryBytes: create.MemoryBytes, Capabilities: create.Capabilities,
		TtlSeconds: create.TTLSeconds, SetupSeed: &seed,
	}
}

// fail tells the API the attempt gets no sandbox. The reason carries only the gRPC code, never agent output.
func (c *Consumer) fail(ctx context.Context, failed job, cause error) error {
	slog.Error("sandbox.create failed", "attempt", failed.create.AttemptID, "error", cause)
	return c.finish(ctx, failed.messageID, queue.SandboxStatus{
		Version: queue.Version, AttemptID: failed.create.AttemptID, Status: queue.StatusFailed,
		Reason: fmt.Sprintf("sandbox could not be started (%s)", status.Code(cause)),
	})
}

// finish publishes before it acks: a crash in between repeats the status, which the API must accept.
func (c *Consumer) finish(ctx context.Context, messageID string, message queue.SandboxStatus) error {
	payload, err := c.codec.EncodeSandboxStatus(message)
	if err != nil {
		return fmt.Errorf("encode %s: %w", queue.StreamSandboxStatus, err)
	}
	err = c.redis.XAdd(ctx, &redis.XAddArgs{
		Stream: queue.StreamSandboxStatus, MaxLen: statusStreamMaxLen, Approx: true,
		Values: map[string]any{queue.PayloadField: string(payload)},
	}).Err()
	if err != nil {
		return fmt.Errorf("publish %s for attempt %s: %w", message.Status, message.AttemptID, err)
	}
	return c.ack(ctx, messageID)
}

func (c *Consumer) ack(ctx context.Context, messageID string) error {
	if err := c.redis.XAck(ctx, queue.StreamSandboxCreate, Group, messageID).Err(); err != nil {
		return fmt.Errorf("ack %s: %w", messageID, err)
	}
	return nil
}
