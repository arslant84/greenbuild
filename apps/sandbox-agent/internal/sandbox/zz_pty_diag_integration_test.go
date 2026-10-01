//go:build integration

package sandbox

// TEMPORARY diagnostic for gVisor PTY behaviour; delete before merge.

import (
	"context"
	"io"
	"testing"
	"time"
)

func TestZZDiagnosePTYOnRealDocker(t *testing.T) {
	for _, resizeAfterOpen := range []bool{false, true} {
		manager := NewManager(newDockerClient(t), runtimeUnderTest())
		spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: 64 << 20, TTL: 5 * time.Minute}
		id, err := manager.CreateSandbox(t.Context(), spec)
		if err != nil {
			t.Fatalf("CreateSandbox() error = %v", err)
		}
		terminal, err := manager.OpenTerminal(t.Context(), id, TerminalSize{Rows: 24, Cols: 80})
		if err != nil {
			t.Fatalf("OpenTerminal() error = %v", err)
		}
		if resizeAfterOpen {
			_ = terminal.Resize(t.Context(), TerminalSize{Rows: 24, Cols: 80})
		}
		output := &lockedBuffer{}
		go func() { _, _ = io.Copy(output, terminal.Output()) }()
		time.Sleep(time.Second)
		_, _ = io.WriteString(terminal.Input(), "ls -l /proc/self/fd/0 /dev/tty; tty; echo TTY=$?; stty -a 2>&1 | head -1; stty -F /dev/tty size; echo DONE\n")
		time.Sleep(3 * time.Second)
		t.Logf("resizeAfterOpen=%v shell=%s\n%s", resizeAfterOpen, describeShell(terminal), output)
		terminal.Close()
		_ = manager.Destroy(context.Background(), id)
	}
}
