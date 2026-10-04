package consumer

import (
	"testing"
	"time"

	"github.com/arslant84/greenbuild/packages/queue"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// startSandbox runs one valid sandbox.create (TTL 900 s) through the consumer.
func (h *harness) startSandbox(t *testing.T) {
	t.Helper()
	h.publishValid(t)
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
}

func (h *harness) expireAfter(t *testing.T, elapsed time.Duration) {
	t.Helper()
	h.clock = h.clock.Add(elapsed)
	if err := h.consumer.expireDue(t.Context()); err != nil {
		t.Fatalf("expireDue() error = %v", err)
	}
}

func (h *harness) lastStatus(t *testing.T) queue.SandboxStatus {
	t.Helper()
	statuses := h.statuses(t)
	return statuses[len(statuses)-1]
}

var expired = queue.SandboxStatus{
	Version: queue.Version, AttemptID: "att-1", Status: queue.StatusDestroyed, SandboxID: "sbx-1", Reason: queue.ReasonExpired,
}

func TestSandboxIsDestroyedAndReportedWhenItsTimeRunsOut(t *testing.T) {
	h := newHarness(t)
	h.startSandbox(t)

	h.expireAfter(t, 899*time.Second)
	if len(h.agent.destroyed) != 0 || h.lastStatus(t).Status != queue.StatusReady {
		t.Fatalf("before the deadline: destroyed %v, last status %+v; want nothing yet", h.agent.destroyed, h.lastStatus(t))
	}

	h.expireAfter(t, 2*time.Second)
	if len(h.agent.destroyed) != 1 || h.agent.destroyed[0] != "sbx-1" {
		t.Errorf("destroyed = %v, want [sbx-1]", h.agent.destroyed)
	}
	if got := h.lastStatus(t); got != expired {
		t.Errorf("last status = %+v, want %+v", got, expired)
	}
}

func TestSandboxTheAgentAlreadyRemovedStillCountsAsExpired(t *testing.T) {
	h := newHarness(t)
	h.startSandbox(t)
	h.agent.destroyErr = status.Error(codes.NotFound, "no such sandbox")

	h.expireAfter(t, 901*time.Second)
	if got := h.lastStatus(t); got != expired {
		t.Errorf("last status = %+v, want %+v", got, expired)
	}
}

func TestExpiryIsRetriedWhileTheAgentIsUnreachable(t *testing.T) {
	h := newHarness(t)
	h.startSandbox(t)
	h.agent.destroyErr = status.Error(codes.Unavailable, "agent down")

	h.expireAfter(t, 901*time.Second)
	if got := h.lastStatus(t); got.Status != queue.StatusReady {
		t.Fatalf("last status = %+v, want no destroyed while the agent is down", got)
	}

	h.agent.destroyErr = nil
	h.expireAfter(t, expiryRetryDelay)
	if got := h.lastStatus(t); got != expired {
		t.Errorf("last status = %+v, want %+v after the agent is back", got, expired)
	}
}

func TestRedeliveredMessageKeepsTheFirstDeadline(t *testing.T) {
	h := newHarness(t)
	h.startSandbox(t)
	h.clock = h.clock.Add(600 * time.Second)
	h.startSandbox(t)

	h.expireAfter(t, 301*time.Second)
	if got := h.lastStatus(t); got != expired {
		t.Errorf("last status = %+v, want %+v 900 s after the first start", got, expired)
	}
}
