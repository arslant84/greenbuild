package agentserver

import (
	"context"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (f *fakeSandboxes) Run(_ context.Context, id string, command sandbox.Command) (sandbox.RunResult, error) {
	f.calls = append(f.calls, fmt.Sprintf("run %s %v %s", id, command.Argv, command.Timeout))
	if len(command.Argv) == 0 {
		return sandbox.RunResult{}, fmt.Errorf("fake run: %w", sandbox.ErrInvalidCommand)
	}
	return sandbox.RunResult{ExitCode: 1, OutputTail: "nginx is down\n", TimedOut: false}, nil
}

func TestRunReturnsTheCommandsResult(t *testing.T) {
	fake := &fakeSandboxes{}
	req := &agentv1.RunRequest{SandboxId: "sbx-1", Command: []string{"/opt/greenbuild/check.sh"}, TimeoutSeconds: 20}

	resp, err := New(fake).Run(t.Context(), req)
	if err != nil {
		t.Fatalf("Run() error = %v; a non-zero exit is a result, not an error", err)
	}
	if resp.GetExitCode() != 1 || string(resp.GetOutputTail()) != "nginx is down\n" || resp.GetTimedOut() {
		t.Errorf("Run() = %v", resp)
	}
	if want := []string{"run sbx-1 [/opt/greenbuild/check.sh] " + (20 * time.Second).String()}; !slices.Equal(fake.calls, want) {
		t.Errorf("calls = %v, want %v", fake.calls, want)
	}
}

func TestRunRejectsBadRequests(t *testing.T) {
	cases := map[string]*agentv1.RunRequest{
		"no sandbox": {Command: []string{"true"}},
		"no command": {SandboxId: "sbx-1"},
	}
	for name, req := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := New(&fakeSandboxes{}).Run(t.Context(), req); status.Code(err) != codes.InvalidArgument {
				t.Errorf("code = %v, want InvalidArgument", status.Code(err))
			}
		})
	}
}
