package agentpool_test

import (
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
)

var errUnreachable = status.Error(codes.Unavailable, "connection refused")

// fakeAgent numbers the sandboxes it creates and records the ids it is called with.
type fakeAgent struct {
	createErr  error
	takeErr    error
	created    int
	calledWith []string
	reports    []agentclient.Destroyed
}

func (a *fakeAgent) CreateSandbox(context.Context, *agentv1.CreateSandboxRequest) (string, error) {
	if a.createErr != nil {
		return "", a.createErr
	}
	a.created++
	return fmt.Sprintf("c%d", a.created), nil
}

func (a *fakeAgent) Destroy(_ context.Context, sandboxID string) error {
	a.calledWith = append(a.calledWith, sandboxID)
	return nil
}

func (a *fakeAgent) TakeDestroyed(context.Context) ([]agentclient.Destroyed, error) {
	if a.takeErr != nil {
		return nil, a.takeErr
	}
	taken := a.reports
	a.reports = nil
	return taken, nil
}

func (a *fakeAgent) CopyIn(_ context.Context, sandboxID string, _ agentclient.File) error {
	a.calledWith = append(a.calledWith, sandboxID)
	return nil
}

func (a *fakeAgent) Run(_ context.Context, sandboxID string, _ agentclient.Command) (agentclient.RunResult, error) {
	a.calledWith = append(a.calledWith, sandboxID)
	return agentclient.RunResult{}, nil
}

func (a *fakeAgent) OpenTerminal(_ context.Context, sandboxID string, _ agentclient.TerminalSize) (*agentclient.Terminal, error) {
	a.calledWith = append(a.calledWith, sandboxID)
	return &agentclient.Terminal{}, nil
}
