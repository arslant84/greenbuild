package agentclient

import (
	"context"
	"fmt"
	"os"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

// File is a file to place in a sandbox, e.g. the checker right before a check.
type File struct {
	Path    string
	Content []byte
	Mode    os.FileMode
}

// Command is a program to run in a sandbox without a terminal; the agent kills it after Timeout.
type Command struct {
	Argv    []string
	Timeout time.Duration
}

// RunResult is a command that finished in a sandbox.
type RunResult struct {
	ExitCode   int32
	OutputTail string
	TimedOut   bool
}

// CopyIn writes file into the sandbox.
func (c *Client) CopyIn(ctx context.Context, sandboxID string, file File) error {
	req := &agentv1.CopyInRequest{SandboxId: sandboxID, Path: file.Path, Content: file.Content, Mode: uint32(file.Mode)}
	if _, err := c.agent.CopyIn(ctx, req); err != nil {
		return fmt.Errorf("copy %s into sandbox %s: %w", file.Path, sandboxID, err)
	}
	return nil
}

// Run executes command in the sandbox and waits for it; a non-zero exit is a result, not an error.
func (c *Client) Run(ctx context.Context, sandboxID string, command Command) (RunResult, error) {
	req := &agentv1.RunRequest{SandboxId: sandboxID, Command: command.Argv, TimeoutSeconds: uint32(command.Timeout.Seconds())}
	resp, err := c.agent.Run(ctx, req)
	if err != nil {
		return RunResult{}, fmt.Errorf("run %v in sandbox %s: %w", command.Argv, sandboxID, err)
	}
	return RunResult{ExitCode: resp.GetExitCode(), OutputTail: string(resp.GetOutputTail()), TimedOut: resp.GetTimedOut()}, nil
}
