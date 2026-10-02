package main

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

// Copied from challenges/nginx-502-upstream/challenge.yaml until manifests are parsed
// (packages/challenge-spec).
const (
	cpuMillis   = 500
	memoryBytes = 512 << 20
	ttlSeconds  = 900
)

const (
	readBlock = 5 * time.Second
	// maxSeed is 2^53-1, the largest seed sandbox.create accepts.
	maxSeed = 1<<53 - 1
)

var errSandboxFailed = errors.New("sandbox failed")

// launcher does what the API will do: put sandbox.create on the queue and wait for the status.
type launcher struct {
	redis redis.Cmdable
	codec *queue.Codec
	image string
}

// start returns the new attempt and its ready sandbox.
func (l launcher) start(ctx context.Context) (string, string, error) {
	attemptID, seed := randomAttempt()
	payload, err := l.codec.EncodeSandboxCreate(queue.SandboxCreate{
		Version: queue.Version, AttemptID: attemptID, Image: l.image, Seed: seed,
		CPUMillis: cpuMillis, MemoryBytes: memoryBytes, TTLSeconds: ttlSeconds, Network: "none",
		Capabilities: []string{"CHOWN", "SETUID", "SETGID"},
	})
	if err != nil {
		return "", "", fmt.Errorf("encode sandbox.create: %w", err)
	}
	published, err := l.redis.XAdd(ctx, &redis.XAddArgs{Stream: queue.StreamSandboxCreate, Values: map[string]any{queue.PayloadField: string(payload)}}).Result()
	if err != nil {
		return "", "", fmt.Errorf("publish sandbox.create: %w", err)
	}
	sandboxID, err := l.waitReady(ctx, attemptID, statusesFrom(published))
	if err != nil {
		return "", "", err
	}
	return attemptID, sandboxID, nil
}

// waitReady reads sandbox.status from the moment the request went out; statuses for other
// attempts and malformed ones are skipped.
func (l launcher) waitReady(ctx context.Context, attemptID, after string) (string, error) {
	for {
		streams, err := l.redis.XRead(ctx, &redis.XReadArgs{Streams: []string{queue.StreamSandboxStatus, after}, Block: readBlock}).Result()
		if errors.Is(err, redis.Nil) && ctx.Err() == nil {
			continue
		}
		if err != nil {
			return "", fmt.Errorf("wait for sandbox.status: %w", err)
		}
		for _, message := range streams[0].Messages {
			after = message.ID
			status, ok := l.statusOf(message, attemptID)
			if !ok {
				continue
			}
			if status.Status == queue.StatusReady {
				return status.SandboxID, nil
			}
			return "", fmt.Errorf("%w: %s %s", errSandboxFailed, status.Status, status.Reason)
		}
	}
}

// statusesFrom turns the request's id into a sandbox.status position. Ids are counted per stream,
// so a status in the same millisecond can carry the very same id; reading from the millisecond
// before cannot miss it.
func statusesFrom(publishedID string) string {
	millis, _, _ := strings.Cut(publishedID, "-")
	parsed, err := strconv.ParseUint(millis, 10, 64)
	if err != nil || parsed == 0 {
		return "0"
	}
	return strconv.FormatUint(parsed-1, 10)
}

func (l launcher) statusOf(message redis.XMessage, attemptID string) (queue.SandboxStatus, bool) {
	payload, _ := message.Values[queue.PayloadField].(string)
	status, err := l.codec.DecodeSandboxStatus([]byte(payload))
	return status, err == nil && status.AttemptID == attemptID
}

func randomAttempt() (string, uint64) {
	var random [16]byte
	_, _ = rand.Read(random[:]) // crypto/rand.Read never fails (Go 1.24+)
	return "dev-" + hex.EncodeToString(random[:8]), binary.BigEndian.Uint64(random[8:]) & maxSeed
}
