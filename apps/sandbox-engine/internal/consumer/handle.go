package consumer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/status"
)

const (
	mappingGrace       = 10 * time.Minute
	statusStreamMaxLen = 100_000
)

// job is one sandbox.create message being handled.
type job struct {
	messageID string
	create    queue.SandboxCreate
}

// AttemptSandboxKey holds the sandbox started for an attempt.
func AttemptSandboxKey(attemptID string) string {
	return "engine:attempt:" + attemptID + ":sandbox"
}

// SandboxAttemptKey holds the attempt a sandbox was started for, so what the agent reports about a
// sandbox reaches the right attempt.
func SandboxAttemptKey(sandboxID string) string {
	return "engine:sandbox:" + sandboxID + ":attempt"
}

// handle returns an error only when Redis fails; agent failures become a failed status or a retry.
func (c *Consumer) handle(ctx context.Context, message redis.XMessage) error {
	create, err := c.decode(message)
	if err != nil {
		// Redelivering cannot fix a malformed message, and without a valid attempt id there is no one to tell.
		slog.Warn("drop invalid sandbox.create", "message", message.ID, "error", err)
		return c.ack(ctx, queue.StreamSandboxCreate, message.ID)
	}
	current := job{messageID: message.ID, create: create}
	sandboxID, err := c.sandboxFor(ctx, create)
	if err != nil {
		return c.handleFailure(ctx, current, err)
	}
	if err := c.scheduleDeadlines(ctx, create); err != nil {
		return err
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

// sandboxFor starts the attempt's sandbox once; a redelivered message gets the same sandbox back.
// If saving the mapping fails, the retry starts a second sandbox and the agent's TTL reaper removes the first.
func (c *Consumer) sandboxFor(ctx context.Context, create queue.SandboxCreate) (string, error) {
	key := AttemptSandboxKey(create.AttemptID)
	existing, err := c.redis.Get(ctx, key).Result()
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, redis.Nil) {
		return "", fmt.Errorf("read %s: %w", key, err)
	}
	sandboxID, err := c.agent.CreateSandbox(ctx, createRequest(create))
	if err != nil {
		return "", fmt.Errorf("start sandbox for attempt %s: %w", create.AttemptID, err)
	}
	ttl := time.Duration(create.TTLSeconds)*time.Second + mappingGrace
	if err := c.redis.Set(ctx, key, sandboxID, ttl).Err(); err != nil {
		return "", fmt.Errorf("save %s: %w", key, err)
	}
	if err := c.redis.Set(ctx, SandboxAttemptKey(sandboxID), create.AttemptID, ttl).Err(); err != nil {
		return "", fmt.Errorf("save %s: %w", SandboxAttemptKey(sandboxID), err)
	}
	return sandboxID, nil
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
	if err := c.publish(ctx, message); err != nil {
		return err
	}
	return c.ack(ctx, queue.StreamSandboxCreate, messageID)
}

func (c *Consumer) publish(ctx context.Context, message queue.SandboxStatus) error {
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
	return nil
}

func (c *Consumer) ack(ctx context.Context, stream, messageID string) error {
	if err := c.redis.XAck(ctx, stream, Group, messageID).Err(); err != nil {
		return fmt.Errorf("ack %s %s: %w", stream, messageID, err)
	}
	return nil
}
