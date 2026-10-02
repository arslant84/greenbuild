//go:build integration

package agentclient_test

// architecture.md, task 10: a message in sandbox.create brings a sandbox up and ready appears in
// sandbox.status. Real Redis in a container, the real agent process and the real challenge image.

import (
	"context"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/consumer"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

const (
	redisImage     = "redis:8-alpine"
	redisReadyWait = 20 * time.Second
	statusWait     = 2 * time.Minute
)

func TestQueueMessageBringsASandboxUpOnRealDocker(t *testing.T) {
	buildChallengeImage(t)
	opts := agentclient.EngineOptions(t, "localhost", agentclient.NewBundle(t, "localhost"))
	agentclient.StartRealAgent(t, opts)
	client := agentclient.Dialed(t, opts)
	rdb := startRedis(t)
	codec, err := queue.NewCodec()
	if err != nil {
		t.Fatal(err)
	}
	runConsumer(t, consumer.New(consumer.Options{Redis: rdb, Agent: client, Codec: codec, Name: "engine-e2e"}))

	payload, err := codec.EncodeSandboxCreate(queue.SandboxCreate{
		Version: queue.Version, AttemptID: "att-e2e", Image: challengeImage, Seed: 4242, CPUMillis: 500,
		MemoryBytes: 512 << 20, TTLSeconds: 300, Network: "none", Capabilities: []string{"CHOWN", "SETUID", "SETGID"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := rdb.XAdd(t.Context(), &redis.XAddArgs{Stream: queue.StreamSandboxCreate, Values: map[string]any{queue.PayloadField: string(payload)}}).Err(); err != nil {
		t.Fatalf("XAdd() error = %v", err)
	}

	got := awaitStatus(t, rdb, codec)
	if got.Status != queue.StatusReady || got.AttemptID != "att-e2e" || got.SandboxID == "" {
		t.Fatalf("status = %+v, want ready for att-e2e", got)
	}
	t.Cleanup(func() { _ = client.Destroy(context.Background(), got.SandboxID) })
	alive, err := client.Run(t.Context(), got.SandboxID, agentclient.Command{Argv: []string{"true"}})
	if err != nil || alive.ExitCode != 0 {
		t.Errorf("run in the ready sandbox = %+v, %v", alive, err)
	}
}

// startRedis runs Redis on a free loopback port and returns a client that has answered PING.
func startRedis(t *testing.T) *redis.Client {
	t.Helper()
	out, err := exec.CommandContext(t.Context(), "docker", "run", "-d", "--rm", "-p", "127.0.0.1::6379", redisImage).Output()
	if err != nil {
		t.Fatalf("start %s: %v", redisImage, err)
	}
	id := strings.TrimSpace(string(out))
	t.Cleanup(func() { _ = exec.Command("docker", "rm", "-f", id).Run() })
	port, err := exec.CommandContext(t.Context(), "docker", "port", id, "6379/tcp").Output()
	if err != nil {
		t.Fatalf("redis port: %v", err)
	}
	addr, _, _ := strings.Cut(strings.TrimSpace(string(port)), "\n")
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	t.Cleanup(func() { _ = rdb.Close() })
	deadline := time.Now().Add(redisReadyWait)
	for rdb.Ping(t.Context()).Err() != nil {
		if time.Now().After(deadline) {
			t.Fatalf("redis at %s did not answer PING", addr)
		}
		time.Sleep(200 * time.Millisecond)
	}
	return rdb
}

// runConsumer runs until the test ends and waits for it, so it never outlives the Redis client.
func runConsumer(t *testing.T, queueConsumer *consumer.Consumer) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- queueConsumer.Run(ctx) }()
	t.Cleanup(func() {
		cancel()
		if err := <-done; err != nil {
			t.Errorf("consumer Run() error = %v", err)
		}
	})
}

func awaitStatus(t *testing.T, rdb *redis.Client, codec *queue.Codec) queue.SandboxStatus {
	t.Helper()
	streams, err := rdb.XRead(t.Context(), &redis.XReadArgs{Streams: []string{queue.StreamSandboxStatus, "0"}, Count: 1, Block: statusWait}).Result()
	if err != nil {
		t.Fatalf("no sandbox.status within %v: %v", statusWait, err)
	}
	payload, _ := streams[0].Messages[0].Values[queue.PayloadField].(string)
	status, err := codec.DecodeSandboxStatus([]byte(payload))
	if err != nil {
		t.Fatalf("decode status: %v", err)
	}
	return status
}
