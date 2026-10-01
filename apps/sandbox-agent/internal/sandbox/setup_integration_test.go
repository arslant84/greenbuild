//go:build integration

package sandbox

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// fakeSetupScript records its seed and nothing else; real challenges break their environment here.
const fakeSetupScript = `mkdir -p /opt/greenbuild && printf '#!/bin/sh\necho "$1" > /tmp/seed\n' > ` +
	SetupScriptPath + ` && chmod +x ` + SetupScriptPath

func TestSetupRunsWithSeedAndIsRemovedOnRealDocker(t *testing.T) {
	manager := NewManager(newDockerClient(t), runtimeUnderTest())
	spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: 64 << 20}
	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() {
		if err := manager.Destroy(context.Background(), id); err != nil {
			t.Logf("cleanup destroy %s: %v", id, err)
		}
	})
	// Written by exec rather than docker cp: under gVisor host-side copies may not reach the sandbox.
	if prepared, err := manager.exec(t.Context(), id, []string{"sh", "-c", fakeSetupScript}); err != nil || prepared.exitCode != 0 {
		t.Fatalf("install fake setup script: %v %+v", err, prepared)
	}

	if err := manager.RunSetup(t.Context(), id, 4242); err != nil {
		t.Fatalf("RunSetup() error = %v", err)
	}

	assertExecOutput(t, manager, id, []string{"cat", "/tmp/seed"}, "4242")
	if present, err := manager.exec(t.Context(), id, []string{"test", "-e", SetupScriptPath}); err != nil || present.exitCode == 0 {
		t.Errorf("setup script still present after RunSetup (err %v, exit %d)", err, present.exitCode)
	}
	if err := manager.RunSetup(t.Context(), id, 4242); !errors.Is(err, ErrSetupFailed) {
		t.Errorf("second RunSetup() error = %v, want ErrSetupFailed because the script is gone", err)
	}
}

func assertExecOutput(t *testing.T, manager *Manager, id string, cmd []string, want string) {
	t.Helper()
	result, err := manager.exec(t.Context(), id, cmd)
	if err != nil {
		t.Fatalf("exec %v: %v", cmd, err)
	}
	if got := strings.TrimSpace(result.output); result.exitCode != 0 || got != want {
		t.Errorf("exec %v = exit %d, %q; want exit 0, %q", cmd, result.exitCode, got, want)
	}
}
