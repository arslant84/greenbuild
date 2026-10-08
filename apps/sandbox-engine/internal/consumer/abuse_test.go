package consumer

import (
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/packages/queue"
)

// architecture.md, task 33f: the agent destroys a sandbox that uses all of its CPU; the engine tells
// the API with a destroyed status and the reason abuse.
func TestSandboxTheAgentDestroyedForAbuseIsReportedOnce(t *testing.T) {
	h := newHarness(t)
	h.startSandbox(t)
	h.agent.reports = []agentclient.Destroyed{{SandboxID: "sbx-1", Reason: queue.ReasonAbuse}}

	if err := h.consumer.collectAgentReports(t.Context()); err != nil {
		t.Fatalf("collectAgentReports() error = %v", err)
	}
	h.expireAfter(t, 0)

	want := queue.SandboxStatus{Version: queue.Version, AttemptID: "att-1", Status: queue.StatusDestroyed, SandboxID: "sbx-1", Reason: queue.ReasonAbuse}
	if got := h.lastStatus(t); got != want {
		t.Fatalf("last status = %+v, want %+v", got, want)
	}
	reported := len(h.statuses(t))
	h.expireAfter(t, 1000*time.Second)
	if len(h.statuses(t)) != reported {
		t.Errorf("statuses after the time limit = %v; the attempt was reported twice", h.statuses(t))
	}
}

func TestReportForAnUnknownSandboxIsIgnored(t *testing.T) {
	h := newHarness(t)
	h.agent.reports = []agentclient.Destroyed{{SandboxID: "sbx-unknown", Reason: queue.ReasonAbuse}}

	if err := h.consumer.collectAgentReports(t.Context()); err != nil {
		t.Fatalf("collectAgentReports() error = %v", err)
	}
	h.expireAfter(t, 0)
	if statuses := h.statuses(t); len(statuses) != 0 {
		t.Errorf("statuses = %v, want none", statuses)
	}
}
