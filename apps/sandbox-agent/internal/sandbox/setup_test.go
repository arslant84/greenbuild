package sandbox

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"slices"
	"strings"
	"testing"

	"github.com/moby/moby/client"
)

type fakeExec struct {
	exitCode int
	output   string
}

func (f *fakeDocker) ExecCreate(_ context.Context, _ string, options client.ExecCreateOptions) (client.ExecCreateResult, error) {
	f.calls = append(f.calls, "exec "+strings.Join(options.Cmd, " "))
	f.lastExec = options
	id := fmt.Sprintf("exec-%d", len(f.calls))
	if f.execIDs == nil {
		f.execIDs = map[string]string{}
	}
	f.execIDs[id] = options.Cmd[0]
	if f.withStdin == nil {
		f.withStdin = map[string]bool{}
	}
	f.withStdin[id] = options.AttachStdin
	return client.ExecCreateResult{ID: id}, nil
}

// ExecAttach plays Docker over a loopback TCP connection: TCP supports half-close, so stdin can
// end before the output is sent. Execs created with stdin read it all first and record it.
func (f *fakeDocker) ExecAttach(_ context.Context, execID string, _ client.ExecAttachOptions) (client.ExecAttachResult, error) {
	agentSide, dockerSide, err := tcpPair()
	if err != nil {
		return client.ExecAttachResult{}, err
	}
	output := []byte(f.execs[f.execIDs[execID]].output)
	readStdin := f.withStdin[execID]
	go func() {
		if readStdin {
			received, _ := io.ReadAll(dockerSide)
			f.recordStdin(execID, received)
		}
		header := make([]byte, 8)
		header[0] = 1 // stdout
		binary.BigEndian.PutUint32(header[4:], uint32(len(output)))
		_, _ = dockerSide.Write(append(header, output...))
		_ = dockerSide.Close()
	}()
	return client.ExecAttachResult{HijackedResponse: client.NewHijackedResponse(agentSide, "")}, nil
}

func (f *fakeDocker) recordStdin(execID string, data []byte) {
	f.stdinMu.Lock()
	defer f.stdinMu.Unlock()
	if f.stdin == nil {
		f.stdin = map[string][]byte{}
	}
	f.stdin[execID] = data
}

func (f *fakeDocker) stdinOf(execID string) []byte {
	f.stdinMu.Lock()
	defer f.stdinMu.Unlock()
	return f.stdin[execID]
}

func tcpPair() (net.Conn, net.Conn, error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, nil, fmt.Errorf("listen: %w", err)
	}
	defer func() { _ = listener.Close() }()
	agentSide, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		return nil, nil, fmt.Errorf("dial: %w", err)
	}
	dockerSide, err := listener.Accept()
	if err != nil {
		return nil, nil, errors.Join(fmt.Errorf("accept: %w", err), agentSide.Close())
	}
	return agentSide, dockerSide, nil
}

func (f *fakeDocker) ExecInspect(_ context.Context, execID string, _ client.ExecInspectOptions) (client.ExecInspectResult, error) {
	return client.ExecInspectResult{ExitCode: f.execs[f.execIDs[execID]].exitCode}, nil
}

func TestRunSetupPassesSeedThenRemovesScript(t *testing.T) {
	docker := &fakeDocker{}

	if err := NewManager(docker, "runsc").RunSetup(t.Context(), fakeContainerID, 4242); err != nil {
		t.Fatalf("RunSetup() error = %v", err)
	}
	want := []string{"exec " + SetupScriptPath + " 4242", "exec rm -f " + SetupScriptPath}
	if !slices.Equal(docker.calls, want) {
		t.Errorf("calls = %v, want %v", docker.calls, want)
	}
}

func TestRunSetupReportsFailureWithOutput(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{
		SetupScriptPath: {exitCode: 2, output: "seed must be a non-negative integer"},
	}}

	err := NewManager(docker, "runsc").RunSetup(t.Context(), fakeContainerID, 1)
	if !errors.Is(err, ErrSetupFailed) {
		t.Fatalf("RunSetup() error = %v, want ErrSetupFailed", err)
	}
	if !strings.Contains(err.Error(), "exited 2") || !strings.Contains(err.Error(), "non-negative integer") {
		t.Errorf("error = %q, want the exit code and the script's output", err)
	}
	if slices.Contains(docker.calls, "exec rm -f "+SetupScriptPath) {
		t.Error("removed the script after a failed setup; keep it so the failure can be investigated")
	}
}

func TestRunSetupFailsWhenScriptCannotBeRemoved(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{
		"rm": {exitCode: 1, output: "rm: can't remove: Read-only file system"},
	}}

	err := NewManager(docker, "runsc").RunSetup(t.Context(), fakeContainerID, 1)
	if !errors.Is(err, ErrSetupFailed) {
		t.Errorf("RunSetup() error = %v, want ErrSetupFailed", err)
	}
}

func TestTailBufferKeepsOnlyTheEnd(t *testing.T) {
	buffer := &tailBuffer{limit: 5}
	_, _ = buffer.Write([]byte("abc"))
	_, _ = buffer.Write([]byte("defgh"))

	if got := buffer.String(); got != "defgh" {
		t.Errorf("tail = %q, want %q", got, "defgh")
	}
}
