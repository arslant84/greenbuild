package sandbox

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/moby/moby/client"
)

const (
	// LabelDeadline holds the Unix time after which the reaper destroys the sandbox.
	// It lives on the container, so deadlines survive an agent restart.
	LabelDeadline = "greenbuild.deadline"

	// DefaultTTLGrace is added to the challenge time limit (architecture.md: TTL from the manifest + 2 minutes).
	DefaultTTLGrace = 2 * time.Minute
)

// deadlineFor returns when a sandbox for spec created now must be gone.
func (m *Manager) deadlineFor(spec Spec) time.Time {
	return m.now().Add(spec.TTL + m.ttlGrace)
}

// ReapExpired destroys every sandbox past its deadline and returns how many it destroyed.
// A sandbox without a readable deadline is destroyed too: nothing may run unbounded because of a bug.
func (m *Manager) ReapExpired(ctx context.Context) (int, error) {
	listed, err := m.docker.ContainerList(ctx, client.ContainerListOptions{
		All:     true,
		Filters: make(client.Filters).Add("label", LabelSandbox+"=true"),
	})
	if err != nil {
		return 0, fmt.Errorf("list sandboxes: %w", err)
	}

	now := m.now()
	destroyed := 0
	var failures []error
	for _, sandbox := range listed.Items {
		if !isExpired(sandbox.Labels, now) {
			continue
		}
		if err := m.Destroy(ctx, sandbox.ID); err != nil {
			failures = append(failures, err)
			continue
		}
		destroyed++
	}
	return destroyed, errors.Join(failures...)
}

// RunReaper calls ReapExpired every interval until ctx is cancelled. It needs no outside command,
// so sandboxes are destroyed on time even when the control plane is unreachable.
func (m *Manager) RunReaper(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		destroyed, err := m.ReapExpired(ctx)
		if err != nil && ctx.Err() == nil {
			slog.Warn("reap expired sandboxes", "error", err)
		}
		if destroyed > 0 {
			slog.Info("destroyed expired sandboxes", "count", destroyed)
		}
	}
}

func isExpired(labels map[string]string, now time.Time) bool {
	deadline, err := strconv.ParseInt(labels[LabelDeadline], 10, 64)
	if err != nil {
		return true
	}
	return !now.Before(time.Unix(deadline, 0))
}
