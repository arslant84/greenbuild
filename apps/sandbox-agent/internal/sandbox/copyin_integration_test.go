//go:build integration

package sandbox

import (
	"context"
	"testing"
	"time"
)

func TestCopyInWritesAnExecutableFileOnRealDocker(t *testing.T) {
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

	checker := File{Path: "/opt/greenbuild/check.sh", Content: []byte("#!/bin/sh\necho checked\nexit 3\n"), Mode: 0o750}
	if err := manager.CopyIn(t.Context(), id, checker); err != nil {
		t.Fatalf("CopyIn() error = %v", err)
	}

	assertExecOutput(t, manager, id, []string{"stat", "-c", "%a", checker.Path}, "750")
	ran, err := manager.exec(t.Context(), id, []string{checker.Path})
	if err != nil {
		t.Fatalf("run copied script: %v", err)
	}
	if ran.exitCode != 3 || ran.output != "checked\n" {
		t.Errorf("copied script = exit %d, %q; want exit 3, \"checked\\n\"", ran.exitCode, ran.output)
	}
}
