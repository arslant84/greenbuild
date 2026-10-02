package agentclient

import (
	"context"
	"fmt"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

// TerminalSize is a terminal window in character cells.
type TerminalSize struct {
	Rows uint32
	Cols uint32
}

// Event is one message from a sandbox terminal: some output, or the exit code at the end.
type Event struct {
	Output   []byte
	Exited   bool
	ExitCode int32
}

// Terminal is a shell in a sandbox, streamed through the agent's Exec. Write, Resize and
// CloseInput must come from one goroutine, Recv from another; gRPC allows one of each at a time.
type Terminal struct {
	stream agentv1.SandboxAgent_ExecClient
	cancel context.CancelFunc
}

// OpenTerminal starts a shell in the sandbox with the given window size.
func (c *Client) OpenTerminal(ctx context.Context, sandboxID string, size TerminalSize) (*Terminal, error) {
	streamCtx, cancel := context.WithCancel(ctx)
	stream, err := c.agent.Exec(streamCtx)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("open terminal in sandbox %s: %w", sandboxID, err)
	}
	start := &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Start{Start: &agentv1.ExecStart{
		SandboxId: sandboxID,
		Size:      &agentv1.TerminalSize{Rows: size.Rows, Cols: size.Cols},
	}}}
	if err := stream.Send(start); err != nil {
		cancel()
		return nil, fmt.Errorf("start terminal in sandbox %s: %w", sandboxID, err)
	}
	return &Terminal{stream: stream, cancel: cancel}, nil
}

// Write sends keystrokes to the shell.
func (t *Terminal) Write(input []byte) (int, error) {
	if err := t.stream.Send(&agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Stdin{Stdin: input}}); err != nil {
		return 0, fmt.Errorf("send terminal input: %w", err)
	}
	return len(input), nil
}

// Resize tells the shell the window changed.
func (t *Terminal) Resize(size TerminalSize) error {
	resize := &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Resize{Resize: &agentv1.TerminalSize{Rows: size.Rows, Cols: size.Cols}}}
	if err := t.stream.Send(resize); err != nil {
		return fmt.Errorf("send terminal resize: %w", err)
	}
	return nil
}

// Recv returns the next output or the exit code. After the exit code the stream ends with io.EOF.
func (t *Terminal) Recv() (Event, error) {
	resp, err := t.stream.Recv()
	if err != nil {
		return Event{}, fmt.Errorf("receive from terminal: %w", err)
	}
	if exit, ok := resp.GetPayload().(*agentv1.ExecResponse_ExitCode); ok {
		return Event{Exited: true, ExitCode: exit.ExitCode}, nil
	}
	return Event{Output: resp.GetOutput()}, nil
}

// CloseInput tells the agent no more input will come; the agent then ends the session.
func (t *Terminal) CloseInput() error {
	if err := t.stream.CloseSend(); err != nil {
		return fmt.Errorf("close terminal input: %w", err)
	}
	return nil
}

// Close abandons the session immediately.
func (t *Terminal) Close() {
	t.cancel()
}
