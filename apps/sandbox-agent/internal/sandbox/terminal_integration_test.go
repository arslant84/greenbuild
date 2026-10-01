//go:build integration

package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/moby/moby/client"
)

const (
	terminalWait   = 15 * time.Second
	ttySizeCommand = "stty -F /dev/tty size\n"
)

// lockedBuffer collects terminal output while the test reads it.
type lockedBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *lockedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	// bytes.Buffer.Write is documented to always return a nil error.
	n, _ := b.buf.Write(p)
	return n, nil
}

func (b *lockedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func TestTerminalRunsCommandsResizesAndExitsOnRealDocker(t *testing.T) {
	manager := NewManager(newDockerClient(t), runtimeUnderTest())
	spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: 64 << 20, TTL: 5 * time.Minute}
	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() {
		if err := manager.Destroy(context.Background(), id); err != nil {
			t.Logf("cleanup destroy %s: %v", id, err)
		}
	})

	terminal, err := manager.OpenTerminal(t.Context(), id, TerminalSize{Rows: 24, Cols: 80})
	if err != nil {
		t.Fatalf("OpenTerminal() error = %v", err)
	}
	defer terminal.Close()
	output := &lockedBuffer{}
	shellDone := make(chan struct{})
	go func() {
		_, _ = io.Copy(output, terminal.Output())
		close(shellDone)
	}()

	// Under gVisor this only works because OpenTerminal applies the size after start.
	typeAndExpect(t, terminal, output, ttySizeCommand, "24 80")
	if err := terminal.Resize(t.Context(), TerminalSize{Rows: 40, Cols: 120}); err != nil {
		t.Fatalf("Resize() error = %v", err)
	}
	typeAndExpect(t, terminal, output, ttySizeCommand, "40 120")
	typeText(t, terminal, "exit 3\n")

	select {
	case <-shellDone:
	case <-time.After(terminalWait):
		t.Fatalf("shell did not exit; output so far:\n%s", output)
	}
	if code, err := terminal.ExitCode(t.Context()); err != nil || code != 3 {
		t.Errorf("ExitCode() = %d, %v; want 3, nil", code, err)
	}
}

func typeText(t *testing.T, terminal *Terminal, text string) {
	t.Helper()
	if _, err := io.WriteString(terminal.Input(), text); err != nil {
		t.Fatalf("type %q: %v", text, err)
	}
}

func typeAndExpect(t *testing.T, terminal *Terminal, output *lockedBuffer, text, want string) {
	t.Helper()
	typeText(t, terminal, text)
	deadline := time.Now().Add(terminalWait)
	for time.Now().Before(deadline) {
		if strings.Contains(output.String(), want) {
			return
		}
		time.Sleep(pollInterval)
	}
	t.Fatalf("after typing %q, output never contained %q (shell: %s):\n%q", text, want, describeShell(terminal), output)
}

// describeShell says whether the shell is still running, to tell "never started" from "no I/O".
func describeShell(terminal *Terminal) string {
	inspected, err := terminal.docker.ExecInspect(context.Background(), terminal.execID, client.ExecInspectOptions{})
	if err != nil {
		return "inspect failed: " + err.Error()
	}
	return fmt.Sprintf("running=%v exit=%d pid=%d", inspected.Running, inspected.ExitCode, inspected.PID)
}
