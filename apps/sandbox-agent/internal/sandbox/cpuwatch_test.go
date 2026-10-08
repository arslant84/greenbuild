package sandbox

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"slices"
	"testing"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

func (f *fakeDocker) ContainerStats(_ context.Context, id string, _ client.ContainerStatsOptions) (client.ContainerStatsResult, error) {
	var response container.StatsResponse
	response.CPUStats.CPUUsage.TotalUsage = f.cpuUsage[id]
	body, err := json.Marshal(response)
	if err != nil {
		return client.ContainerStatsResult{}, fmt.Errorf("marshal stats: %w", err)
	}
	return client.ContainerStatsResult{Body: io.NopCloser(bytes.NewReader(body))}, nil
}

const sweepInterval = 10 * time.Second

// A sandbox limited to half a CPU (500 millis).
func halfCPUSandbox(id string) container.Summary {
	return container.Summary{ID: id, Labels: map[string]string{LabelSandbox: "true", LabelCPUMillis: "500"}}
}

// sweeps runs n sweeps 10 s apart; busy sandboxes use their whole half CPU, idle ones nothing.
func sweeps(t *testing.T, n int, busyIDs ...string) ([]string, *fakeDocker) {
	t.Helper()
	docker := &fakeDocker{sandboxes: []container.Summary{halfCPUSandbox("busy"), halfCPUSandbox("idle")}, cpuUsage: map[string]uint64{}}
	now := fixedNow
	manager := NewManager(docker, "runsc")
	manager.now = func() time.Time { return now }
	watch := NewCPUWatch(manager)
	var destroyed []string
	for range n {
		gone, err := watch.Sweep(t.Context())
		if err != nil {
			t.Fatalf("Sweep() error = %v", err)
		}
		destroyed = append(destroyed, gone...)
		now = now.Add(sweepInterval)
		for _, id := range busyIDs {
			docker.cpuUsage[id] += uint64(sweepInterval.Nanoseconds() / 2)
		}
	}
	return destroyed, docker
}

func TestCPUWatchDestroysASandboxBusyForLongerThanTheWindow(t *testing.T) {
	sweepsPastWindow := int(DefaultAbuseWindow/sweepInterval) + 2
	destroyed, docker := sweeps(t, sweepsPastWindow, "busy")
	if !slices.Equal(destroyed, []string{"busy"}) {
		t.Errorf("destroyed = %v, want only the busy sandbox", destroyed)
	}
	if !slices.Contains(docker.calls, "remove busy") {
		t.Errorf("calls = %v, want the busy sandbox removed", docker.calls)
	}
}

func TestCPUWatchRecordsWhatItDestroyedForTheControlPlane(t *testing.T) {
	docker := &fakeDocker{sandboxes: []container.Summary{halfCPUSandbox("busy")}, cpuUsage: map[string]uint64{}}
	manager := NewManager(docker, "runsc")
	now := fixedNow
	manager.now = func() time.Time { return now }
	watch := NewCPUWatch(manager)
	for range int(DefaultAbuseWindow/sweepInterval) + 2 {
		if _, err := watch.Sweep(t.Context()); err != nil {
			t.Fatalf("Sweep() error = %v", err)
		}
		now = now.Add(sweepInterval)
		docker.cpuUsage["busy"] += uint64(sweepInterval.Nanoseconds() / 2)
	}
	if taken := manager.TakeDestroyed(); !slices.Equal(taken, []Destroyed{{SandboxID: "busy", Reason: ReasonAbuse}}) {
		t.Errorf("TakeDestroyed() = %v, want busy destroyed for abuse", taken)
	}
	if again := manager.TakeDestroyed(); len(again) != 0 {
		t.Errorf("second TakeDestroyed() = %v, want nothing", again)
	}
}

func TestCPUWatchSparesASandboxBusyForLessThanTheWindow(t *testing.T) {
	sweepsInsideWindow := int(DefaultAbuseWindow / sweepInterval)
	if destroyed, _ := sweeps(t, sweepsInsideWindow, "busy"); len(destroyed) != 0 {
		t.Errorf("destroyed = %v after %d sweeps, want none yet", destroyed, sweepsInsideWindow)
	}
}

func TestBusyNeedsNearlyTheWholeLimit(t *testing.T) {
	start := cpuSample{at: fixedNow}
	for _, share := range []struct {
		percent int
		busy    bool
	}{{100, true}, {96, true}, {80, false}} {
		used := uint64(sweepInterval.Nanoseconds()/2) * uint64(share.percent) / 100
		if got := busy(start, cpuSample{usageNanos: used, at: fixedNow.Add(sweepInterval)}, 500); got != share.busy {
			t.Errorf("busy at %d%% of the limit = %v, want %v", share.percent, got, share.busy)
		}
	}
	if busy(start, cpuSample{usageNanos: 1 << 40, at: fixedNow.Add(sweepInterval)}, 0) {
		t.Error("a sandbox without a CPU label was judged busy")
	}
}
