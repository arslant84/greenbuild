//go:build integration

package sandbox

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/moby/moby/client"
)

// architecture.md, task 33e: with Docker's userns-remap on the node, root inside a sandbox is an
// unprivileged UID on the host. The daemon setting comes from .github/scripts/install-gvisor.sh,
// so this runs only in the gVisor CI job (-run OnRunsc) on a Linux host that can read /proc.
func TestSandboxRootIsUnprivilegedOnHostOnRunsc(t *testing.T) {
	docker := newDockerClient(t)
	manager := NewManager(docker, "runsc")
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

	inside, err := manager.Run(t.Context(), id, Command{Argv: []string{"id", "-u"}, Timeout: timeoutBudget})
	if err != nil || strings.TrimSpace(inside.OutputTail) != "0" {
		t.Fatalf("id -u in sandbox = %+v, %v; want 0 (root inside)", inside, err)
	}
	inspected, err := docker.ContainerInspect(t.Context(), id, client.ContainerInspectOptions{})
	if err != nil {
		t.Fatalf("inspect %s: %v", id, err)
	}
	hostUID, err := effectiveUID(inspected.Container.State.Pid)
	if err != nil || hostUID == "0" {
		t.Errorf("host UID of sandbox process %d = %q, %v; want an unprivileged UID", inspected.Container.State.Pid, hostUID, err)
	}
}

// effectiveUID reads a host process's effective UID from the "Uid:" line of /proc/<pid>/status
// (real, effective, saved, filesystem).
func effectiveUID(pid int) (string, error) {
	status, err := os.ReadFile(fmt.Sprintf("/proc/%d/status", pid))
	if err != nil {
		return "", fmt.Errorf("read status of %d: %w", pid, err)
	}
	for line := range strings.SplitSeq(string(status), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 3 && fields[0] == "Uid:" {
			return fields[2], nil
		}
	}
	return "", fmt.Errorf("no Uid line in status of %d", pid)
}
