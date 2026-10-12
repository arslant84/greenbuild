//go:build integration

package sandbox

import (
	"context"
	"testing"
	"time"

	"github.com/moby/moby/client"
)

// Experiment (never merged): why does filling the root overlay kill the sandbox under runsc?

func TestDiskFillExperimentOnRunsc(t *testing.T) {
	for _, memory := range []int64{256 << 20, 4 << 30} {
		for _, fill := range []string{"100", "400", "2048"} {
			t.Run("mem"+time.Duration(memory).String()+"-fill"+fill, func(t *testing.T) {
				fillExperiment(t, memory, fill)
			})
		}
	}
}

func fillExperiment(t *testing.T, memory int64, fillMiB string) {
	docker := newDockerClient(t)
	manager := NewManager(docker, "runsc")
	spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: memory, TTL: 5 * time.Minute}
	id, err := manager.CreateSandbox(t.Context(), spec)
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() { _ = manager.Destroy(context.Background(), id) })

	fill := []string{"sh", "-c", "dd if=/dev/zero of=/fill bs=1M count=" + fillMiB + " 2>&1; echo dd=$?; df -m / 2>&1; ls -la / | head -3"}
	result, err := manager.Run(t.Context(), id, Command{Argv: fill, Timeout: 2 * time.Minute})
	t.Logf("fill %s MiB, memory %d MiB: err=%v exit=%d output=%q", fillMiB, memory>>20, err, result.ExitCode, result.OutputTail)
	inspected, err := docker.ContainerInspect(t.Context(), id, client.ContainerInspectOptions{})
	if err != nil {
		t.Logf("inspect: %v", err)
		return
	}
	state := inspected.Container.State
	t.Logf("state: running=%v oomKilled=%v exitCode=%d error=%q", state.Running, state.OOMKilled, state.ExitCode, state.Error)
}
