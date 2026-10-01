package agentserver

import (
	"bytes"
	"context"
	"errors"
	"io"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const execTestTimeout = 5 * time.Second

// fakeTerminal records input and resizes; its output ends when the test closes outputWriter.
type fakeTerminal struct {
	mu           sync.Mutex
	input        bytes.Buffer
	resizes      []sandbox.TerminalSize
	resized      chan struct{}
	outputReader *io.PipeReader
	outputWriter *io.PipeWriter
	exitCode     int
}

func newFakeTerminal(exitCode int) *fakeTerminal {
	reader, writer := io.Pipe()
	return &fakeTerminal{resized: make(chan struct{}, 1), outputReader: reader, outputWriter: writer, exitCode: exitCode}
}

func (f *fakeTerminal) Input() io.Writer  { return writerFunc(f.write) }
func (f *fakeTerminal) Output() io.Reader { return f.outputReader }
func (f *fakeTerminal) Close()            { _ = f.outputReader.Close() }

func (f *fakeTerminal) write(p []byte) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.input.Write(p)
	return len(p), nil
}

func (f *fakeTerminal) Resize(_ context.Context, size sandbox.TerminalSize) error {
	f.mu.Lock()
	f.resizes = append(f.resizes, size)
	f.mu.Unlock()
	f.resized <- struct{}{}
	return nil
}

func (f *fakeTerminal) ExitCode(context.Context) (int, error) { return f.exitCode, nil }

type writerFunc func([]byte) (int, error)

func (w writerFunc) Write(p []byte) (int, error) { return w(p) }

// fakeExecStream feeds requests from a channel and records responses.
type fakeExecStream struct {
	grpc.ServerStream
	ctx       context.Context
	requests  chan *agentv1.ExecRequest
	mu        sync.Mutex
	responses []*agentv1.ExecResponse
}

func (s *fakeExecStream) Context() context.Context { return s.ctx }

func (s *fakeExecStream) Recv() (*agentv1.ExecRequest, error) {
	req, ok := <-s.requests
	if !ok {
		return nil, io.EOF
	}
	return req, nil
}

func (s *fakeExecStream) Send(resp *agentv1.ExecResponse) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.responses = append(s.responses, resp)
	return nil
}

func (f *fakeSandboxes) OpenTerminal(_ context.Context, id string, size sandbox.TerminalSize) (Terminal, error) {
	f.calls = append(f.calls, "terminal "+id)
	f.terminalSize = size
	if f.terminal == nil {
		return nil, errors.New("docker unavailable")
	}
	return f.terminal, nil
}

func startRequest(id string) *agentv1.ExecRequest {
	return &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Start{Start: &agentv1.ExecStart{
		SandboxId: id, Size: &agentv1.TerminalSize{Rows: 24, Cols: 80},
	}}}
}

func TestExecForwardsInputResizeOutputAndExitCode(t *testing.T) {
	terminal := newFakeTerminal(3)
	sandboxes := &fakeSandboxes{terminal: terminal}
	stream := &fakeExecStream{ctx: t.Context(), requests: make(chan *agentv1.ExecRequest, 3)}
	stream.requests <- startRequest("sbx-1")
	stream.requests <- &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Stdin{Stdin: []byte("ls\n")}}
	stream.requests <- &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Resize{Resize: &agentv1.TerminalSize{Rows: 40, Cols: 120}}}

	go func() {
		<-terminal.resized // stdin was handled before the resize
		_, _ = terminal.outputWriter.Write([]byte("bin  etc\n"))
		_ = terminal.outputWriter.Close()
	}()
	if err := runWithTimeout(t, func() error { return New(sandboxes).Exec(stream) }); err != nil {
		t.Fatalf("Exec() error = %v", err)
	}

	if sandboxes.terminalSize != (sandbox.TerminalSize{Rows: 24, Cols: 80}) {
		t.Errorf("opened with %+v, want 24x80", sandboxes.terminalSize)
	}
	terminal.mu.Lock()
	if terminal.input.String() != "ls\n" || !slices.Equal(terminal.resizes, []sandbox.TerminalSize{{Rows: 40, Cols: 120}}) {
		t.Errorf("input %q, resizes %v; want \"ls\\n\" and one 40x120 resize", terminal.input.String(), terminal.resizes)
	}
	terminal.mu.Unlock()

	responses := stream.responses
	if len(responses) != 2 || string(responses[0].GetOutput()) != "bin  etc\n" || responses[1].GetExitCode() != 3 {
		t.Errorf("responses = %v, want the output then exit code 3", responses)
	}
	if _, ok := responses[1].GetPayload().(*agentv1.ExecResponse_ExitCode); !ok {
		t.Error("the last response must be the exit code")
	}
}

func TestExecRejectsAStreamThatDoesNotStartWithExecStart(t *testing.T) {
	stream := &fakeExecStream{ctx: t.Context(), requests: make(chan *agentv1.ExecRequest, 1)}
	stream.requests <- &agentv1.ExecRequest{Payload: &agentv1.ExecRequest_Stdin{Stdin: []byte("rm -rf /\n")}}

	err := New(&fakeSandboxes{}).Exec(stream)
	if status.Code(err) != codes.InvalidArgument {
		t.Errorf("code = %v, want InvalidArgument", status.Code(err))
	}
}

func TestExecReportsATerminalThatCannotOpen(t *testing.T) {
	stream := &fakeExecStream{ctx: t.Context(), requests: make(chan *agentv1.ExecRequest, 1)}
	stream.requests <- startRequest("sbx-1")

	err := New(&fakeSandboxes{}).Exec(stream)
	if status.Code(err) != codes.Internal {
		t.Errorf("code = %v, want Internal", status.Code(err))
	}
}

func TestExecEndsTheSessionWhenTheClientStopsSending(t *testing.T) {
	terminal := newFakeTerminal(0)
	stream := &fakeExecStream{ctx: t.Context(), requests: make(chan *agentv1.ExecRequest, 1)}
	stream.requests <- startRequest("sbx-1")
	close(stream.requests)

	// Output never ends on its own here: only closing the terminal on EOF lets Exec return.
	if err := runWithTimeout(t, func() error { return New(&fakeSandboxes{terminal: terminal}).Exec(stream) }); err != nil {
		t.Fatalf("Exec() error = %v", err)
	}
}

func runWithTimeout(t *testing.T, run func() error) error {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- run() }()
	select {
	case err := <-done:
		return err
	case <-time.After(execTestTimeout):
		t.Fatal("Exec did not return")
		return nil
	}
}
