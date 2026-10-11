//go:build integration

package sandbox

import (
	"context"
	"strings"
	"testing"
	"time"
)

const (
	// fillMiB is well above the 1 GiB root overlay cap runsc gets in .github/scripts/install-gvisor.sh,
	// and small enough that an uncapped runner writes it quickly and fails the test.
	fillMiB = "2048"
	// Writing the fill takes a few seconds; the budget only stops a hung sandbox.
	fillTimeout = 2 * time.Minute
)

// architecture.md, task 33b: under gVisor a sandbox's writable root is capped, so filling it fails
// with ENOSPC instead of filling the node's disk. The cap is a runsc flag, so this runs only in the
// gVisor CI job (-run OnRunsc); runc sandboxes are not capped.
func TestSandboxRootfsWriteLimitOnRunsc(t *testing.T) {
	manager := NewManager(newDockerClient(t), "runsc")
	spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: 256 << 20, TTL: 5 * time.Minute}
	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() {
		if err := manager.Destroy(context.Background(), id); err != nil {
			t.Logf("cleanup destroy %s: %v", id, err)
		}
	})

	fill := []string{"dd", "if=/dev/zero", "of=/fill", "bs=1M", "count=" + fillMiB}
	result, err := manager.Run(t.Context(), id, Command{Argv: fill, Timeout: fillTimeout})
	if err != nil || result.ExitCode == 0 || !strings.Contains(result.OutputTail, "No space left on device") {
		t.Errorf("writing %s MiB = %+v, %v; want ENOSPC (No space left on device)", fillMiB, result, err)
	}
}
