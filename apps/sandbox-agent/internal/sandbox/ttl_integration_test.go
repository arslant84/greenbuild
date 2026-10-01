//go:build integration

package sandbox

import (
	"context"
	"testing"
	"time"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/client"
)

const (
	shortTTL            = time.Second
	testReapInterval    = 500 * time.Millisecond
	disappearanceWindow = 20 * time.Second
	pollInterval        = 250 * time.Millisecond
)

func TestSandboxDisappearsAfterTTLWithoutCommandsOnRealDocker(t *testing.T) {
	docker := newDockerClient(t)
	manager := NewManager(docker, runtimeUnderTest())
	manager.ttlGrace = 0
	spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: 64 << 20, TTL: shortTTL}

	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() {
		if err := manager.Destroy(context.Background(), id); err != nil {
			t.Logf("cleanup destroy %s: %v", id, err)
		}
	})

	// The reaper is the only thing running from here on: no Destroy call, no outside command.
	reaperCtx, stopReaper := context.WithCancel(t.Context())
	defer stopReaper()
	go manager.RunReaper(reaperCtx, testReapInterval)

	deadline := time.Now().Add(disappearanceWindow)
	for time.Now().Before(deadline) {
		_, err := docker.ContainerInspect(t.Context(), id, client.ContainerInspectOptions{})
		if cerrdefs.IsNotFound(err) {
			return
		}
		time.Sleep(pollInterval)
	}
	t.Fatalf("sandbox %s still exists %s after a %s TTL", id, disappearanceWindow, shortTTL)
}
