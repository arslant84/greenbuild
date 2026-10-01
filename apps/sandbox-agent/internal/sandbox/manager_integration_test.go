//go:build integration

package sandbox

import (
	"context"
	"io"
	"os"
	"slices"
	"strings"
	"testing"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

// Runs against the Docker daemon from the environment (DOCKER_HOST or the platform default).
// SANDBOX_TEST_RUNTIME selects the runtime: runc locally, runsc in CI.
const integrationImage = "alpine:3"

func runtimeUnderTest() string {
	if runtime := os.Getenv("SANDBOX_TEST_RUNTIME"); runtime != "" {
		return runtime
	}
	return "runc"
}

func newDockerClient(t *testing.T) *client.Client {
	t.Helper()
	docker, err := client.New(client.FromEnv)
	if err != nil {
		t.Fatalf("docker client: %v", err)
	}
	t.Cleanup(func() {
		if err := docker.Close(); err != nil {
			t.Logf("close docker client: %v", err)
		}
	})

	pull, err := docker.ImagePull(t.Context(), integrationImage, client.ImagePullOptions{})
	if err != nil {
		t.Fatalf("pull %s: %v", integrationImage, err)
	}
	defer func() {
		if err := pull.Close(); err != nil {
			t.Logf("close pull stream: %v", err)
		}
	}()
	if _, err := io.Copy(io.Discard, pull); err != nil {
		t.Fatalf("read pull progress: %v", err)
	}
	return docker
}

func TestSandboxLifecycleOnRealDocker(t *testing.T) {
	docker := newDockerClient(t)
	manager := NewManager(docker, runtimeUnderTest())
	spec := Spec{
		Image:        integrationImage,
		Command:      []string{"sleep", "300"},
		CPUMillis:    500,
		MemoryBytes:  64 << 20,
		Capabilities: []string{"CHOWN"},
	}

	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	// Safety net if an assertion fails first; t.Context() is already cancelled during cleanup.
	t.Cleanup(func() {
		if err := manager.Destroy(context.Background(), id); err != nil {
			t.Logf("cleanup destroy %s: %v", id, err)
		}
	})

	inspected, err := docker.ContainerInspect(t.Context(), id, client.ContainerInspectOptions{})
	if err != nil {
		t.Fatalf("inspect %s: %v", id, err)
	}
	assertRunningWithLimits(t, inspected.Container, spec)

	if err := manager.Destroy(t.Context(), id); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}
	if _, err := docker.ContainerInspect(t.Context(), id, client.ContainerInspectOptions{}); !cerrdefs.IsNotFound(err) {
		t.Errorf("inspect after Destroy: error = %v, want not found", err)
	}
	if err := manager.Destroy(t.Context(), id); err != nil {
		t.Errorf("second Destroy() error = %v, want nil", err)
	}
}

// assertRunningWithLimits checks what the daemon applied, not what we asked for.
func assertRunningWithLimits(t *testing.T, got container.InspectResponse, spec Spec) {
	t.Helper()
	if got.State == nil || !got.State.Running {
		t.Errorf("container is not running: %+v", got.State)
	}
	if got.Config.Labels[LabelSandbox] != "true" {
		t.Errorf("label %s missing", LabelSandbox)
	}
	assertIsolation(t, got.HostConfig)
	assertLimits(t, got.HostConfig, spec)
	// The daemon reports capabilities in canonical form, e.g. CHOWN as CAP_CHOWN.
	applied := make([]string, 0, len(got.HostConfig.CapAdd))
	for _, capability := range got.HostConfig.CapAdd {
		applied = append(applied, strings.TrimPrefix(capability, "CAP_"))
	}
	if !slices.Equal(applied, spec.Capabilities) {
		t.Errorf("CapAdd = %v, want %v", got.HostConfig.CapAdd, spec.Capabilities)
	}
}

func assertIsolation(t *testing.T, host *container.HostConfig) {
	t.Helper()
	if host.Runtime != runtimeUnderTest() {
		t.Errorf("Runtime = %q, want %q", host.Runtime, runtimeUnderTest())
	}
	if host.NetworkMode != "none" {
		t.Errorf("NetworkMode = %q, want none", host.NetworkMode)
	}
	if !slices.Equal(host.CapDrop, []string{"ALL"}) {
		t.Errorf("CapDrop = %v, want [ALL]", host.CapDrop)
	}
	if !slices.Contains(host.SecurityOpt, "no-new-privileges") {
		t.Errorf("SecurityOpt = %v, want no-new-privileges", host.SecurityOpt)
	}
}

func assertLimits(t *testing.T, host *container.HostConfig, spec Spec) {
	t.Helper()
	if host.NanoCPUs != spec.CPUMillis*nanoCPUsPerMilliCPU || host.Memory != spec.MemoryBytes {
		t.Errorf("NanoCPUs = %d, Memory = %d, want %d and %d",
			host.NanoCPUs, host.Memory, spec.CPUMillis*nanoCPUsPerMilliCPU, spec.MemoryBytes)
	}
	if host.PidsLimit == nil || *host.PidsLimit != PidsLimit {
		t.Errorf("PidsLimit = %v, want %d", host.PidsLimit, PidsLimit)
	}
}
