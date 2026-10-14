//go:build integration

package agentclient_test

// architecture.md, task 57a: the engine works with several agents, picks a node with a free slot and
// reports one it cannot reach. Two real agent processes on the Docker daemon from the environment.

import (
	"context"
	"errors"
	"os/exec"
	"strings"
	"testing"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentpool"
)

var sleeper = &agentv1.CreateSandboxRequest{
	Image: "alpine:3", Command: []string{"sleep", "300"}, CpuMillis: 500, MemoryBytes: 64 << 20, TtlSeconds: 300,
}

func TestPoolStartsOneSandboxOnEachOfTwoAgentsOnRealDocker(t *testing.T) {
	agentclient.EnsureImage(t)
	bundle := agentclient.NewBundle(t, "localhost")
	pool := agentpool.New([]agentpool.Node{
		{Name: "node-a", Agent: startedAgent(t, agentclient.EngineOptions(t, "localhost", bundle)), Slots: 1},
		{Name: "node-b", Agent: startedAgent(t, agentclient.EngineOptions(t, "localhost", bundle)), Slots: 1},
	})

	first, second := startSleeper(t, pool), startSleeper(t, pool)
	if !strings.HasPrefix(first, "node-a/") || !strings.HasPrefix(second, "node-b/") {
		t.Fatalf("sandbox ids %q and %q, want one on node-a and one on node-b", first, second)
	}
	if _, err := pool.CreateSandbox(t.Context(), sleeper); !errors.Is(err, agentpool.ErrNoCapacity) {
		t.Errorf("third CreateSandbox() error = %v, want ErrNoCapacity", err)
	}
	for _, id := range []string{first, second} {
		ran, err := pool.Run(t.Context(), id, agentclient.Command{Argv: []string{"true"}})
		if err != nil || ran.ExitCode != 0 {
			t.Errorf("run in %s = %+v, %v; want exit 0", id, ran, err)
		}
		if err := pool.Destroy(t.Context(), id); err != nil {
			t.Fatalf("Destroy(%s) error = %v", id, err)
		}
		_, containerID, _ := strings.Cut(id, "/")
		if exec.CommandContext(t.Context(), "docker", "inspect", containerID).Run() == nil {
			t.Errorf("container of %s still exists after Destroy", id)
		}
	}
}

func TestPoolStartsTheSandboxOnTheAgentThatAnswersOnRealDocker(t *testing.T) {
	agentclient.EnsureImage(t)
	bundle := agentclient.NewBundle(t, "localhost")
	// Nothing listens on node-a's address: its agent is down.
	down := agentclient.Dialed(t, agentclient.EngineOptions(t, "localhost", bundle))
	pool := agentpool.New([]agentpool.Node{
		{Name: "node-a", Agent: down, Slots: 5},
		{Name: "node-b", Agent: startedAgent(t, agentclient.EngineOptions(t, "localhost", bundle)), Slots: 1},
	})

	if id := startSleeper(t, pool); !strings.HasPrefix(id, "node-b/") {
		t.Errorf("sandbox id %q, want it on node-b while node-a is down", id)
	}
}

func startedAgent(t *testing.T, opts agentclient.Options) *agentclient.Client {
	t.Helper()
	agentclient.StartRealAgent(t, opts)
	return agentclient.Dialed(t, opts)
}

// startSleeper starts a sandbox through the pool and destroys it when the test ends, if it still exists.
func startSleeper(t *testing.T, pool *agentpool.Pool) string {
	t.Helper()
	id, err := pool.CreateSandbox(t.Context(), sleeper)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() { _ = pool.Destroy(context.Background(), id) })
	return id
}
