//go:build integration

package main

import (
	"context"
	"testing"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

// architecture.md, task 27: with a player's terminal (Exec stream) open, stopping the agent still
// finishes within the shutdown timeout instead of waiting for the player to leave.

const (
	shutdownTimeout = time.Second
	// Room for the forced stop itself after the timeout.
	shutdownSlack = 3 * time.Second
)

func TestStopFinishesWithinTimeoutWhileATerminalIsOpen(t *testing.T) {
	agent := startAgentWithin(t, shutdownTimeout)
	client := dial(t, agent.addr, agent.bundle, true)
	created, err := client.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{
		Image: e2eImage, Command: []string{"sleep", "300"}, CpuMillis: 500, MemoryBytes: 64 << 20, TtlSeconds: 300,
	})
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() { _ = agent.manager.Destroy(context.Background(), created.GetSandboxId()) })

	stream := openTerminal(t, client, created.GetSandboxId())
	started := time.Now()
	agent.stop()
	elapsed := time.Since(started)

	if elapsed < shutdownTimeout || elapsed > shutdownTimeout+shutdownSlack {
		t.Errorf("stop took %v with a terminal open; want about %v (graceful, then forced)", elapsed, shutdownTimeout)
	}
	if !streamEnds(stream) {
		t.Error("the terminal stream stayed open after the agent stopped")
	}
}

// streamEnds reads what the stream had buffered and reports whether it then ends with an error.
func streamEnds(stream agentv1.SandboxAgent_ExecClient) bool {
	const bufferedMessagesMax = 100
	for range bufferedMessagesMax {
		if _, err := stream.Recv(); err != nil {
			return true
		}
	}
	return false
}

// openTerminal starts a shell in the sandbox and waits for its first output, so the stream is live.
func openTerminal(t *testing.T, client agentv1.SandboxAgentClient, id string) agentv1.SandboxAgent_ExecClient {
	t.Helper()
	stream, err := client.Exec(t.Context())
	if err != nil {
		t.Fatalf("Exec() error = %v", err)
	}
	start := &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Start{Start: &agentv1.ExecStart{SandboxId: id, Size: &agentv1.TerminalSize{Cols: 80, Rows: 24}}}}
	if err := stream.Send(start); err != nil {
		t.Fatalf("Send(start) error = %v", err)
	}
	if err := stream.Send(&agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Stdin{Stdin: []byte("echo ready\n")}}); err != nil {
		t.Fatalf("Send(stdin) error = %v", err)
	}
	if _, err := stream.Recv(); err != nil {
		t.Fatalf("Recv() error = %v", err)
	}
	return stream
}
