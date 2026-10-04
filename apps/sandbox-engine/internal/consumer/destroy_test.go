package consumer

import (
	"testing"
	"time"

	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

var abandoned = queue.SandboxStatus{
	Version: queue.Version, AttemptID: "att-1", Status: queue.StatusDestroyed, SandboxID: "sbx-1", Reason: queue.ReasonAbandoned,
}

func (h *harness) requestDestroy(t *testing.T, payload string) {
	t.Helper()
	err := h.redis.XAdd(t.Context(), &redis.XAddArgs{Stream: queue.StreamSandboxDestroy, Values: map[string]any{queue.PayloadField: payload}}).Err()
	if err != nil {
		t.Fatalf("XAdd() error = %v", err)
	}
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
}

func (h *harness) pendingDestroys(t *testing.T) int64 {
	t.Helper()
	summary, err := h.redis.XPending(t.Context(), queue.StreamSandboxDestroy, Group).Result()
	if err != nil {
		t.Fatalf("XPending() error = %v", err)
	}
	return summary.Count
}

const abandonRequest = `{"version":1,"attempt_id":"att-1","reason":"abandoned"}`

func TestGivingUpDestroysTheSandboxAndReportsAbandoned(t *testing.T) {
	h := newIdleHarness(t)
	h.startSandbox(t)
	h.requestDestroy(t, abandonRequest)

	h.expireAfter(t, 0)
	if len(h.agent.destroyed) != 1 || h.lastStatus(t) != abandoned {
		t.Fatalf("destroyed %v, last status %+v; want sbx-1 destroyed and %+v", h.agent.destroyed, h.lastStatus(t), abandoned)
	}
	if got := h.pendingDestroys(t); got != 0 {
		t.Errorf("pending sandbox.destroy = %d, want the request acked", got)
	}

	h.expireAfter(t, 20*time.Minute)
	if got := h.destroyedStatuses(t); got != 1 {
		t.Errorf("destroyed statuses = %d, want 1: the idle and time-limit deadlines must not report again", got)
	}
}

func TestInvalidDestroyRequestIsDropped(t *testing.T) {
	h := newHarness(t)
	h.startSandbox(t)
	h.requestDestroy(t, `{"version":1,"attempt_id":"att-1","reason":"expired"}`)

	h.expireAfter(t, 0)
	if len(h.agent.destroyed) != 0 || h.pendingDestroys(t) != 0 {
		t.Errorf("destroyed %v, pending %d; want the request acked and nothing destroyed", h.agent.destroyed, h.pendingDestroys(t))
	}
}
