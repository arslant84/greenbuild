package agentpool_test

import (
	"errors"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentpool"
)

func mustCreate(t *testing.T, pool *agentpool.Pool) string {
	t.Helper()
	id, err := pool.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{})
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	return id
}

func TestCreateSandboxPicksTheNodeWithTheMostFreeSlots(t *testing.T) {
	pool := agentpool.New([]agentpool.Node{
		{Name: "a", Agent: &fakeAgent{}, Slots: 1},
		{Name: "b", Agent: &fakeAgent{}, Slots: 2},
	})

	got := []string{mustCreate(t, pool), mustCreate(t, pool), mustCreate(t, pool)}
	want := []string{"b/c1", "a/c1", "b/c2"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("sandbox ids = %v, want %v", got, want)
		}
	}
}

func TestCreateSandboxSkipsAnUnreachableNode(t *testing.T) {
	pool := agentpool.New([]agentpool.Node{
		{Name: "a", Agent: &fakeAgent{createErr: errUnreachable}, Slots: 5},
		{Name: "b", Agent: &fakeAgent{}, Slots: 1},
	})

	if got := mustCreate(t, pool); got != "b/c1" {
		t.Errorf("sandbox id = %q, want b/c1", got)
	}
}

func TestCreateSandboxUsesARecoveredNodeAgain(t *testing.T) {
	flaky := &fakeAgent{createErr: errUnreachable}
	pool := agentpool.New([]agentpool.Node{
		{Name: "a", Agent: flaky, Slots: 5},
		{Name: "b", Agent: &fakeAgent{}, Slots: 1},
	})
	mustCreate(t, pool)

	flaky.createErr = nil
	if got := mustCreate(t, pool); got != "a/c1" {
		t.Errorf("sandbox id = %q, want a/c1 once node a answers again", got)
	}
}

func TestCreateSandboxReportsNoCapacityAsUnavailable(t *testing.T) {
	pool := agentpool.New([]agentpool.Node{{Name: "a", Agent: &fakeAgent{}, Slots: 1}})
	mustCreate(t, pool)

	_, err := pool.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{})
	if !errors.Is(err, agentpool.ErrNoCapacity) || status.Code(err) != codes.Unavailable {
		t.Errorf("CreateSandbox() error = %v, want ErrNoCapacity with code Unavailable", err)
	}
}

func TestCreateSandboxReturnsAnAgentRejectionWithoutTryingOtherNodes(t *testing.T) {
	rejected := status.Error(codes.InvalidArgument, "bad image")
	other := &fakeAgent{}
	pool := agentpool.New([]agentpool.Node{
		{Name: "a", Agent: &fakeAgent{createErr: rejected}, Slots: 2},
		{Name: "b", Agent: other, Slots: 1},
	})

	_, err := pool.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{})
	if status.Code(err) != codes.InvalidArgument || other.created != 0 {
		t.Errorf("error = %v, node b created %d; want InvalidArgument and nothing on b", err, other.created)
	}
}
