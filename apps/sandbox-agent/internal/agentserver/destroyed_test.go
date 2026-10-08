package agentserver

import (
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

func TestTakeDestroyedHandsOverEachSandboxOnce(t *testing.T) {
	sandboxes := &fakeSandboxes{destroyed: []sandbox.Destroyed{{SandboxID: "s1", Reason: sandbox.ReasonAbuse}}}
	server := New(sandboxes)

	first, err := server.TakeDestroyed(t.Context(), &agentv1.TakeDestroyedRequest{})
	if err != nil || len(first.GetSandboxes()) != 1 || first.GetSandboxes()[0].GetSandboxId() != "s1" || first.GetSandboxes()[0].GetReason() != "abuse" {
		t.Fatalf("TakeDestroyed() = %v, %v; want s1 destroyed for abuse", first, err)
	}
	second, err := server.TakeDestroyed(t.Context(), &agentv1.TakeDestroyedRequest{})
	if err != nil || len(second.GetSandboxes()) != 0 {
		t.Errorf("second TakeDestroyed() = %v, %v; want nothing left", second, err)
	}
}
