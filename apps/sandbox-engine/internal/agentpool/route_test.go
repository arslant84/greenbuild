package agentpool_test

import (
	"slices"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentpool"
)

func twoNodes() (*agentpool.Pool, *fakeAgent, *fakeAgent) {
	a, b := &fakeAgent{}, &fakeAgent{}
	pool := agentpool.New([]agentpool.Node{{Name: "a", Agent: a, Slots: 1}, {Name: "b", Agent: b, Slots: 1}})
	return pool, a, b
}

func TestCallsReachTheNodeNamedInTheSandboxID(t *testing.T) {
	pool, a, b := twoNodes()
	ctx := t.Context()

	if err := pool.CopyIn(ctx, "b/c7", agentclient.File{Path: "/check.sh"}); err != nil {
		t.Fatalf("CopyIn() error = %v", err)
	}
	if _, err := pool.Run(ctx, "b/c7", agentclient.Command{Argv: []string{"true"}}); err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if _, err := pool.OpenTerminal(ctx, "b/c7", agentclient.TerminalSize{}); err != nil {
		t.Fatalf("OpenTerminal() error = %v", err)
	}
	if err := pool.Destroy(ctx, "b/c7"); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}
	if want := []string{"c7", "c7", "c7", "c7"}; !slices.Equal(b.calledWith, want) || len(a.calledWith) != 0 {
		t.Errorf("node b called with %v, node a with %v; want %v on b only", b.calledWith, a.calledWith, want)
	}
}

func TestDestroyFreesTheSlot(t *testing.T) {
	pool := agentpool.New([]agentpool.Node{{Name: "a", Agent: &fakeAgent{}, Slots: 1}})
	id := mustCreate(t, pool)

	if err := pool.Destroy(t.Context(), id); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}
	if got := mustCreate(t, pool); got != "a/c2" {
		t.Errorf("sandbox after Destroy = %q, want a/c2 in the freed slot", got)
	}
}

func TestASandboxIDWithoutANodeGoesToTheFirstNode(t *testing.T) {
	pool, a, _ := twoNodes()

	if err := pool.Destroy(t.Context(), "3f2a9c"); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}
	if !slices.Equal(a.calledWith, []string{"3f2a9c"}) {
		t.Errorf("node a called with %v, want [3f2a9c]", a.calledWith)
	}
}

func TestASandboxIDOnAnUnknownNodeIsNotFound(t *testing.T) {
	pool, _, _ := twoNodes()

	err := pool.Destroy(t.Context(), "gone/c1")
	if status.Code(err) != codes.NotFound {
		t.Errorf("Destroy() error = %v, want code NotFound", err)
	}
}

func TestTakeDestroyedNamesTheNodeAndFreesItsSlots(t *testing.T) {
	pool, a, _ := twoNodes()
	id := mustCreate(t, pool)
	mustCreate(t, pool)
	a.reports = []agentclient.Destroyed{{SandboxID: "c1", Reason: "abuse"}}

	taken, err := pool.TakeDestroyed(t.Context())
	if err != nil {
		t.Fatalf("TakeDestroyed() error = %v", err)
	}
	want := []agentclient.Destroyed{{SandboxID: id, Reason: "abuse"}}
	if !slices.Equal(taken, want) {
		t.Fatalf("taken = %v, want %v", taken, want)
	}
	if got := mustCreate(t, pool); got != "a/c2" {
		t.Errorf("next sandbox = %q, want a/c2 in the freed slot", got)
	}
}

func TestTakeDestroyedReturnsTheOtherNodesReportsWhenOneFails(t *testing.T) {
	pool, a, b := twoNodes()
	a.takeErr = errUnreachable
	b.reports = []agentclient.Destroyed{{SandboxID: "c4", Reason: "expired"}}

	taken, err := pool.TakeDestroyed(t.Context())
	if err != nil || len(taken) != 1 || taken[0].SandboxID != "b/c4" {
		t.Errorf("TakeDestroyed() = %v, %v; want b/c4 and no error", taken, err)
	}
}

func TestTakeDestroyedFailsWhenEveryNodeFails(t *testing.T) {
	pool, a, b := twoNodes()
	a.takeErr, b.takeErr = errUnreachable, errUnreachable

	if _, err := pool.TakeDestroyed(t.Context()); err == nil {
		t.Error("TakeDestroyed() error = nil, want an error")
	}
}
