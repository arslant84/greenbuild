package consumer

import (
	"context"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type fakeAgent struct {
	requests []*agentv1.CreateSandboxRequest
	err      error
}

func (a *fakeAgent) CreateSandbox(_ context.Context, req *agentv1.CreateSandboxRequest) (string, error) {
	a.requests = append(a.requests, req)
	if a.err != nil {
		return "", a.err
	}
	return fmt.Sprintf("sbx-%d", len(a.requests)), nil
}

type harness struct {
	consumer *Consumer
	agent    *fakeAgent
	server   *miniredis.Miniredis
	redis    *redis.Client
	codec    *queue.Codec
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	codec, err := queue.NewCodec()
	if err != nil {
		t.Fatalf("NewCodec() error = %v", err)
	}
	server := miniredis.RunT(t)
	server.SetTime(time.Now())
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	h := &harness{agent: &fakeAgent{}, server: server, redis: client, codec: codec}
	h.consumer = New(Options{Redis: client, Agent: h.agent, Codec: codec, Name: "engine-1"})
	if err := h.consumer.ensureGroup(t.Context()); err != nil {
		t.Fatalf("ensureGroup() error = %v", err)
	}
	return h
}

func validCreate() queue.SandboxCreate {
	return queue.SandboxCreate{
		Version: queue.Version, AttemptID: "att-1", Image: "greenbuild-challenge/nginx-502-upstream:1", Seed: 4242,
		CPUMillis: 500, MemoryBytes: 512 << 20, TTLSeconds: 900, Network: "none", Capabilities: []string{"CHOWN"},
	}
}

func (h *harness) publish(t *testing.T, payload string) {
	t.Helper()
	err := h.redis.XAdd(t.Context(), &redis.XAddArgs{Stream: queue.StreamSandboxCreate, Values: map[string]any{queue.PayloadField: payload}}).Err()
	if err != nil {
		t.Fatalf("XAdd() error = %v", err)
	}
}

func (h *harness) publishValid(t *testing.T) {
	t.Helper()
	payload, err := h.codec.EncodeSandboxCreate(validCreate())
	if err != nil {
		t.Fatalf("EncodeSandboxCreate() error = %v", err)
	}
	h.publish(t, string(payload))
}

func (h *harness) statuses(t *testing.T) []queue.SandboxStatus {
	t.Helper()
	entries, err := h.redis.XRange(t.Context(), queue.StreamSandboxStatus, "-", "+").Result()
	if err != nil {
		t.Fatalf("XRange() error = %v", err)
	}
	var statuses []queue.SandboxStatus
	for _, entry := range entries {
		payload, _ := entry.Values[queue.PayloadField].(string)
		message, err := h.codec.DecodeSandboxStatus([]byte(payload))
		if err != nil {
			t.Fatalf("status %s: %v", entry.ID, err)
		}
		statuses = append(statuses, message)
	}
	return statuses
}

func (h *harness) pending(t *testing.T) int64 {
	t.Helper()
	summary, err := h.redis.XPending(t.Context(), queue.StreamSandboxCreate, Group).Result()
	if err != nil {
		t.Fatalf("XPending() error = %v", err)
	}
	return summary.Count
}

func TestReadyAfterTheSandboxStarts(t *testing.T) {
	h := newHarness(t)
	h.publishValid(t)
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
	seed := uint64(4242)
	want := &agentv1.CreateSandboxRequest{
		Image: "greenbuild-challenge/nginx-502-upstream:1", Command: []string{"sleep", "infinity"}, CpuMillis: 500,
		MemoryBytes: 512 << 20, Capabilities: []string{"CHOWN"}, TtlSeconds: 900, SetupSeed: &seed,
	}
	if len(h.agent.requests) != 1 || !reflect.DeepEqual(h.agent.requests[0], want) {
		t.Errorf("agent requests = %v, want one %v", h.agent.requests, want)
	}
	ready := queue.SandboxStatus{Version: queue.Version, AttemptID: "att-1", Status: queue.StatusReady, SandboxID: "sbx-1"}
	if got := h.statuses(t); len(got) != 1 || got[0] != ready {
		t.Errorf("statuses = %+v, want %+v", got, ready)
	}
	if got, _ := h.server.Get(AttemptSandboxKey("att-1")); got != "sbx-1" {
		t.Errorf("attempt mapping = %q, want sbx-1", got)
	}
	if ttl := h.server.TTL(AttemptSandboxKey("att-1")); ttl != 900*time.Second+mappingGrace {
		t.Errorf("mapping TTL = %v, want sandbox TTL plus grace", ttl)
	}
	if n := h.pending(t); n != 0 {
		t.Errorf("pending = %d, want 0", n)
	}
}

func TestInvalidMessageIsDropped(t *testing.T) {
	h := newHarness(t)
	h.publish(t, `{"version":1,"attempt_id":"att-1","privileged":true}`)
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
	if len(h.agent.requests) != 0 || len(h.statuses(t)) != 0 || h.pending(t) != 0 {
		t.Errorf("requests %d, statuses %v, pending %d; want the message acked and nothing else", len(h.agent.requests), h.statuses(t), h.pending(t))
	}
}

func TestRedeliveryReusesTheSandbox(t *testing.T) {
	h := newHarness(t)
	if err := h.server.Set(AttemptSandboxKey("att-1"), "sbx-earlier"); err != nil {
		t.Fatal(err)
	}
	h.publishValid(t)
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
	if len(h.agent.requests) != 0 {
		t.Errorf("agent called %d times, want 0", len(h.agent.requests))
	}
	if got := h.statuses(t); len(got) != 1 || got[0].SandboxID != "sbx-earlier" {
		t.Errorf("statuses = %+v, want ready with sbx-earlier", got)
	}
}

func TestRejectedRequestFailsAtOnce(t *testing.T) {
	h := newHarness(t)
	h.agent.err = fmt.Errorf("create sandbox on agent: %w", status.Error(codes.InvalidArgument, "no such image"))
	h.publishValid(t)
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
	failed := queue.SandboxStatus{Version: queue.Version, AttemptID: "att-1", Status: queue.StatusFailed, Reason: "sandbox could not be started (InvalidArgument)"}
	if got := h.statuses(t); len(got) != 1 || got[0] != failed {
		t.Errorf("statuses = %+v, want %+v", got, failed)
	}
	if n := h.pending(t); n != 0 {
		t.Errorf("pending = %d, want 0", n)
	}
}

func TestEnsureGroupIsIdempotent(t *testing.T) {
	h := newHarness(t)
	if err := h.consumer.ensureGroup(t.Context()); err != nil {
		t.Errorf("second ensureGroup() error = %v", err)
	}
}
