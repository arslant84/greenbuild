package agentclient

import (
	"context"
	"testing"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

func (f *fakeAgent) CopyIn(_ context.Context, req *agentv1.CopyInRequest) (*agentv1.CopyInResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.copied = req
	return &agentv1.CopyInResponse{}, nil
}

func (f *fakeAgent) Run(_ context.Context, req *agentv1.RunRequest) (*agentv1.RunResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ran = req
	return &agentv1.RunResponse{ExitCode: 1, OutputTail: []byte("the site does not answer with 200\n")}, nil
}

func TestCopyInAndRunReachTheAgent(t *testing.T) {
	bundle := newBundle(t, "localhost")
	addr, agent := startFakeAgent(t, bundle)
	client := dialed(t, engineOptions(t, addr, "localhost", bundle))
	ctx, cancel := context.WithTimeout(t.Context(), callTimeout)
	defer cancel()

	file := File{Path: "/opt/greenbuild/check.sh", Content: []byte("exit 0"), Mode: 0o700}
	if err := client.CopyIn(ctx, "sbx-1", file); err != nil {
		t.Fatalf("CopyIn() error = %v", err)
	}
	result, err := client.Run(ctx, "sbx-1", Command{Argv: []string{file.Path}, Timeout: 20 * time.Second})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if result != (RunResult{ExitCode: 1, OutputTail: "the site does not answer with 200\n"}) {
		t.Errorf("Run() = %+v", result)
	}

	agent.mu.Lock()
	defer agent.mu.Unlock()
	if agent.copied.GetPath() != file.Path || agent.copied.GetMode() != 0o700 || string(agent.copied.GetContent()) != "exit 0" {
		t.Errorf("agent got CopyIn %v", agent.copied)
	}
	if agent.ran.GetSandboxId() != "sbx-1" || agent.ran.GetTimeoutSeconds() != 20 || agent.ran.GetCommand()[0] != file.Path {
		t.Errorf("agent got Run %v", agent.ran)
	}
}
