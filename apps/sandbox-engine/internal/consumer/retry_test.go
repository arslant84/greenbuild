package consumer

import (
	"testing"
	"time"

	"github.com/arslant84/greenbuild/packages/queue"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestTransientErrorIsRetriedThenFails(t *testing.T) {
	h := newHarness(t)
	h.agent.err = status.Error(codes.Unavailable, "agent restarting")
	h.publishValid(t)
	if err := h.consumer.poll(t.Context()); err != nil {
		t.Fatalf("poll() error = %v", err)
	}
	for try := 2; try <= maxDeliveries; try++ {
		if got := h.statuses(t); len(got) != 0 || h.pending(t) != 1 {
			t.Fatalf("before try %d: statuses %+v, pending %d; want none and 1", try, got, h.pending(t))
		}
		h.server.SetTime(time.Now().Add(time.Duration(try) * 2 * claimIdle))
		if err := h.consumer.reclaim(t.Context()); err != nil {
			t.Fatalf("reclaim() error = %v", err)
		}
	}
	if len(h.agent.requests) != maxDeliveries {
		t.Errorf("agent called %d times, want %d", len(h.agent.requests), maxDeliveries)
	}
	if got := h.statuses(t); len(got) != 1 || got[0].Status != queue.StatusFailed || h.pending(t) != 0 {
		t.Errorf("statuses = %+v, pending %d; want one failed and none pending", got, h.pending(t))
	}
}
