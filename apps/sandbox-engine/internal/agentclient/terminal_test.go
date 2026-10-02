package agentclient

import (
	"context"
	"errors"
	"fmt"
	"io"
	"testing"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

const fakeExitCode = 7

// Exec plays a tiny shell: it greets with its size, echoes input, reports resizes, and exits
// with fakeExitCode when the client closes its input.
func (f *fakeAgent) Exec(stream agentv1.SandboxAgent_ExecServer) error {
	first, err := stream.Recv()
	if err != nil {
		return fmt.Errorf("fake exec start: %w", err)
	}
	start := first.GetStart()
	if err := sendOutput(stream, fmt.Sprintf("ready %s %dx%d", start.GetSandboxId(), start.GetSize().GetCols(), start.GetSize().GetRows())); err != nil {
		return err
	}
	for {
		req, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return wrapSend(stream.Send(&agentv1.ExecResponse{Payload: &agentv1.ExecResponse_ExitCode{ExitCode: fakeExitCode}}))
		}
		if err != nil {
			return fmt.Errorf("fake exec recv: %w", err)
		}
		if stdin := req.GetStdin(); stdin != nil {
			err = sendOutput(stream, "echo:"+string(stdin))
		} else if resize := req.GetResize(); resize != nil {
			err = sendOutput(stream, fmt.Sprintf("size %dx%d", resize.GetCols(), resize.GetRows()))
		}
		if err != nil {
			return err
		}
	}
}

func sendOutput(stream agentv1.SandboxAgent_ExecServer, text string) error {
	return wrapSend(stream.Send(&agentv1.ExecResponse{Payload: &agentv1.ExecResponse_Output{Output: []byte(text)}}))
}

func expectOutput(t *testing.T, terminal *Terminal, want string) {
	t.Helper()
	event, err := terminal.Recv()
	if err != nil {
		t.Fatalf("Recv() error = %v, want output %q", err, want)
	}
	if event.Exited || string(event.Output) != want {
		t.Fatalf("Recv() = %+v, want output %q", event, want)
	}
}

func TestTerminalStreamsBothWaysAndEndsWithTheExitCode(t *testing.T) {
	bundle := newBundle(t, "localhost")
	addr, _ := startFakeAgent(t, bundle)
	client := dialed(t, engineOptions(t, addr, "localhost", bundle))
	ctx, cancel := context.WithTimeout(t.Context(), callTimeout)
	defer cancel()

	terminal, err := client.OpenTerminal(ctx, "sbx-1", TerminalSize{Rows: 24, Cols: 80})
	if err != nil {
		t.Fatalf("OpenTerminal() error = %v", err)
	}
	defer terminal.Close()
	expectOutput(t, terminal, "ready sbx-1 80x24")

	if _, err := terminal.Write([]byte("ls\n")); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	expectOutput(t, terminal, "echo:ls\n")
	if err := terminal.Resize(TerminalSize{Rows: 40, Cols: 120}); err != nil {
		t.Fatalf("Resize() error = %v", err)
	}
	expectOutput(t, terminal, "size 120x40")

	if err := terminal.CloseInput(); err != nil {
		t.Fatalf("CloseInput() error = %v", err)
	}
	event, err := terminal.Recv()
	if err != nil || !event.Exited || event.ExitCode != fakeExitCode {
		t.Fatalf("Recv() = %+v, %v; want exit code %d", event, err, fakeExitCode)
	}
	if _, err := terminal.Recv(); !errors.Is(err, io.EOF) {
		t.Errorf("Recv() after the exit code error = %v, want io.EOF", err)
	}
}

func wrapSend(err error) error {
	if err != nil {
		return fmt.Errorf("fake exec send: %w", err)
	}
	return nil
}
