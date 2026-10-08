//go:build integration

package sandbox

import (
	"context"
	"slices"
	"testing"
	"time"
)

// architecture.md, task 33f: a sandbox that keeps its CPU busy (yes > /dev/null) is destroyed; an
// idle one is not. The window is shortened from a minute so the test stays quick.
const (
	testAbuseWindow   = 6 * time.Second
	testSweepInterval = 2 * time.Second
	testWatchBudget   = 30 * time.Second
)

func startSandbox(t *testing.T, manager *Manager, command ...string) string {
	t.Helper()
	spec := Spec{Image: integrationImage, Command: command, CPUMillis: 500, MemoryBytes: 64 << 20, TTL: 5 * time.Minute}
	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() { _ = manager.Destroy(context.Background(), id) })
	return id
}

func TestCPUWatchDestroysABusySandboxOnRealDocker(t *testing.T) {
	manager := NewManager(newDockerClient(t), runtimeUnderTest())
	busyID := startSandbox(t, manager, "sh", "-c", "yes > /dev/null")
	idleID := startSandbox(t, manager, "sleep", "300")
	watch := NewCPUWatch(manager)
	watch.window = testAbuseWindow

	deadline := time.Now().Add(testWatchBudget)
	var destroyed []string
	for time.Now().Before(deadline) && !slices.Contains(destroyed, busyID) {
		gone, err := watch.Sweep(t.Context())
		if err != nil {
			t.Fatalf("Sweep() error = %v", err)
		}
		destroyed = append(destroyed, gone...)
		time.Sleep(testSweepInterval)
	}
	if !slices.Contains(destroyed, busyID) {
		t.Fatalf("the busy sandbox survived %v of sweeps; destroyed %v", testWatchBudget, destroyed)
	}
	if slices.Contains(destroyed, idleID) {
		t.Error("the idle sandbox was destroyed too")
	}
}
