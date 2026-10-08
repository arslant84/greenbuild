package sandbox

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

const (
	// LabelCPUMillis holds the sandbox's CPU limit, which its usage is measured against.
	LabelCPUMillis = "greenbuild.cpu_millis"

	// DefaultAbuseWindow is how long a sandbox may use all of its CPU before it is destroyed
	// (architecture.md, task 33f: 100% for over 60 s).
	DefaultAbuseWindow = 60 * time.Second

	// busyShare counts a sandbox as at 100%: sampling and scheduling never quite reach the limit.
	busyShare        = 0.95
	nanosPerCPUMilli = 1_000_000
)

// cpuSample is what the watch remembers about one sandbox between sweeps.
type cpuSample struct {
	usageNanos uint64
	at         time.Time
	busySince  time.Time
}

// CPUWatch destroys sandboxes that keep their whole CPU share busy for longer than window, e.g.
// mining or a runaway loop. Like the TTL reaper it needs no outside command.
type CPUWatch struct {
	manager *Manager
	window  time.Duration
	samples map[string]cpuSample
}

// NewCPUWatch returns a watch over manager's sandboxes with the default window.
func NewCPUWatch(manager *Manager) *CPUWatch {
	return &CPUWatch{manager: manager, window: DefaultAbuseWindow, samples: map[string]cpuSample{}}
}

// Sweep samples every sandbox's CPU usage and destroys those busy for longer than the window. It
// returns the IDs it destroyed.
func (w *CPUWatch) Sweep(ctx context.Context) ([]string, error) {
	listed, err := w.manager.docker.ContainerList(ctx, client.ContainerListOptions{
		Filters: make(client.Filters).Add("label", LabelSandbox+"=true"),
	})
	if err != nil {
		return nil, fmt.Errorf("list sandboxes: %w", err)
	}
	seen := map[string]cpuSample{}
	var destroyed []string
	var failures []error
	for _, sandbox := range listed.Items {
		sample, abusive, err := w.sample(ctx, sandbox)
		if err != nil {
			failures = append(failures, err)
			continue
		}
		if !abusive {
			seen[sandbox.ID] = sample
			continue
		}
		if err := w.manager.Destroy(ctx, sandbox.ID); err != nil {
			failures = append(failures, err)
			continue
		}
		slog.Warn("destroyed a sandbox that used all of its CPU", "sandbox", sandbox.ID, "for", w.window)
		destroyed = append(destroyed, sandbox.ID)
	}
	w.samples = seen
	return destroyed, errors.Join(failures...)
}

// sample reads one sandbox's usage and reports whether it has been busy for longer than the window.
func (w *CPUWatch) sample(ctx context.Context, sandbox container.Summary) (cpuSample, bool, error) {
	usage, err := w.usageNanos(ctx, sandbox.ID)
	if err != nil {
		return cpuSample{}, false, err
	}
	now := w.manager.now()
	current := cpuSample{usageNanos: usage, at: now}
	previous, known := w.samples[sandbox.ID]
	if !known || !busy(previous, current, cpuLimitMillis(sandbox.Labels)) {
		return current, false, nil
	}
	current.busySince = previous.busySince
	if current.busySince.IsZero() {
		current.busySince = previous.at
	}
	return current, now.Sub(current.busySince) >= w.window, nil
}

// busy reports whether the sandbox used at least busyShare of its CPU limit between two samples.
func busy(previous, current cpuSample, limitMillis int64) bool {
	elapsed := current.at.Sub(previous.at)
	if elapsed <= 0 || limitMillis <= 0 || current.usageNanos < previous.usageNanos {
		return false
	}
	allowed := float64(elapsed.Nanoseconds()) * float64(limitMillis) / 1000
	return float64(current.usageNanos-previous.usageNanos) >= busyShare*allowed
}

// cpuLimitMillis reads the label CreateSandbox sets; without it a sandbox is never judged busy.
func cpuLimitMillis(labels map[string]string) int64 {
	millis, err := strconv.ParseInt(labels[LabelCPUMillis], 10, 64)
	if err != nil {
		return 0
	}
	return millis
}

func (w *CPUWatch) usageNanos(ctx context.Context, id string) (uint64, error) {
	stats, err := w.manager.docker.ContainerStats(ctx, id, client.ContainerStatsOptions{})
	if err != nil {
		return 0, fmt.Errorf("read stats of sandbox %s: %w", id, err)
	}
	defer func() { _ = stats.Body.Close() }()
	var response container.StatsResponse
	if err := json.NewDecoder(stats.Body).Decode(&response); err != nil {
		return 0, fmt.Errorf("decode stats of sandbox %s: %w", id, err)
	}
	return response.CPUStats.CPUUsage.TotalUsage, nil
}

// Run sweeps every interval until ctx is cancelled.
func (w *CPUWatch) Run(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := w.Sweep(ctx); err != nil {
				slog.Warn("cpu watch", "error", err)
			}
		}
	}
}
