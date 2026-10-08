//go:build integration

package sandbox

import (
	"context"
	"strconv"
	"strings"
	"testing"
	"time"
)

// architecture.md, task 33a: a sandbox may not have more than NofileLimit files open, and cannot
// raise the limit itself. Runs under SANDBOX_TEST_RUNTIME (runsc in CI).
func TestSandboxOpenFileLimitOnRealDocker(t *testing.T) {
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

	limits, err := manager.Run(t.Context(), id, Command{Argv: []string{"sh", "-c", "ulimit -Sn; ulimit -Hn"}, Timeout: timeoutBudget})
	want := strconv.FormatInt(NofileLimit, 10)
	if err != nil || strings.Join(strings.Fields(limits.OutputTail), " ") != want+" "+want {
		t.Errorf("open-file limits = %q, %v; want soft and hard %s", limits.OutputTail, err, want)
	}

	raise := "ulimit -n " + strconv.FormatInt(NofileLimit+1, 10)
	raised, err := manager.Run(t.Context(), id, Command{Argv: []string{"sh", "-c", raise}, Timeout: timeoutBudget})
	if err != nil || raised.ExitCode == 0 {
		t.Errorf("%q = %+v, %v; want an error: the sandbox cannot raise its limit", raise, raised, err)
	}
}
