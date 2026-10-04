package consumer

import (
	"testing"
	"time"

	"github.com/arslant84/greenbuild/packages/queue"
)

const testIdleTimeout = 5 * time.Minute

var idle = queue.SandboxStatus{
	Version: queue.Version, AttemptID: "att-1", Status: queue.StatusDestroyed, SandboxID: "sbx-1", Reason: queue.ReasonIdle,
}

func newIdleHarness(t *testing.T) *harness {
	t.Helper()
	h := newHarness(t)
	h.consumer.idleTimeout = testIdleTimeout
	return h
}

func (h *harness) touch(t *testing.T, attemptID string) {
	t.Helper()
	if err := h.consumer.Touch(t.Context(), attemptID); err != nil {
		t.Fatalf("Touch() error = %v", err)
	}
}

func (h *harness) destroyedStatuses(t *testing.T) int {
	t.Helper()
	count := 0
	for _, status := range h.statuses(t) {
		if status.Status == queue.StatusDestroyed {
			count++
		}
	}
	return count
}

func TestSandboxWithoutActivityIsDestroyedAsIdle(t *testing.T) {
	h := newIdleHarness(t)
	h.startSandbox(t)

	h.expireAfter(t, testIdleTimeout+time.Second)
	if got := h.lastStatus(t); got != idle {
		t.Errorf("last status = %+v, want %+v", got, idle)
	}
}

func TestActivityKeepsTheSandboxAlive(t *testing.T) {
	h := newIdleHarness(t)
	h.startSandbox(t)

	h.clock = h.clock.Add(4 * time.Minute)
	h.touch(t, "att-1")
	h.expireAfter(t, 2*time.Minute)
	if len(h.agent.destroyed) != 0 {
		t.Fatalf("destroyed = %v six minutes after start with activity at four, want nothing", h.agent.destroyed)
	}

	h.expireAfter(t, 3*time.Minute+time.Second)
	if got := h.lastStatus(t); got != idle {
		t.Errorf("last status = %+v, want %+v five minutes after the last activity", got, idle)
	}
}

func TestIdleSandboxIsNotReportedAgainWhenItsTimeLimitPasses(t *testing.T) {
	h := newIdleHarness(t)
	h.startSandbox(t)

	h.expireAfter(t, testIdleTimeout+time.Second)
	h.expireAfter(t, 15*time.Minute)
	if got := h.destroyedStatuses(t); got != 1 {
		t.Errorf("destroyed statuses = %d, want 1", got)
	}
}

func TestTouchingAnUnknownAttemptSchedulesNothing(t *testing.T) {
	h := newIdleHarness(t)
	h.touch(t, "att-unknown")

	h.expireAfter(t, time.Hour)
	if got := h.destroyedStatuses(t); got != 0 {
		t.Errorf("destroyed statuses = %d, want 0", got)
	}
}
