//go:build integration

package sandbox

import (
	"context"
	"testing"
	"time"
)

const timeoutBudget = 10 * time.Second

func TestRunReturnsExitCodesAndKillsOnTimeoutOnRealDocker(t *testing.T) {
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

	done, err := manager.Run(t.Context(), id, Command{Argv: []string{"sh", "-c", "echo checked; exit 5"}, Timeout: timeoutBudget})
	if err != nil || done.ExitCode != 5 || done.OutputTail != "checked\n" || done.TimedOut {
		t.Errorf("Run() = %+v, %v; want exit 5 with output \"checked\\n\"", done, err)
	}

	started := time.Now()
	hung, err := manager.Run(t.Context(), id, Command{Argv: []string{"sleep", "60"}, Timeout: time.Second})
	if err != nil || !hung.TimedOut {
		t.Errorf("Run() = %+v, %v; want TimedOut", hung, err)
	}
	if elapsed := time.Since(started); elapsed > timeoutBudget {
		t.Errorf("a 1 s timeout took %s; the command was not killed inside the sandbox", elapsed)
	}
}
