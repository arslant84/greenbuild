//go:build integration

package sandbox

import (
	"context"
	"strings"
	"testing"
	"time"
)

// architecture.md, task 33d: every sandbox runs under Docker's default seccomp profile. The kernel
// lets an unprivileged process create a user namespace; the profile refuses unshare without
// CAP_SYS_ADMIN, so the call fails with EPERM. Runs under SANDBOX_TEST_RUNTIME (runsc in CI, which
// enforces the profile only with --oci-seccomp).
func TestSandboxSeccompRefusesUserNamespaceOnRealDocker(t *testing.T) {
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

	result, err := manager.Run(t.Context(), id, Command{Argv: []string{"unshare", "-U", "true"}, Timeout: timeoutBudget})
	if err != nil || result.ExitCode == 0 || !strings.Contains(result.OutputTail, "Operation not permitted") {
		t.Errorf("unshare -U = %+v, %v; want EPERM (Operation not permitted)", result, err)
	}
}
