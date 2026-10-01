package sandbox

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

var fixedNow = time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)

func (f *fakeDocker) ContainerList(_ context.Context, options client.ContainerListOptions) (client.ContainerListResult, error) {
	f.listed = options
	return client.ContainerListResult{Items: f.sandboxes}, nil
}

func managerAt(docker DockerAPI, now time.Time) *Manager {
	manager := NewManager(docker, "runsc")
	manager.now = func() time.Time { return now }
	return manager
}

func sandboxWithDeadline(id, deadline string) container.Summary {
	labels := map[string]string{LabelSandbox: "true"}
	if deadline != "" {
		labels[LabelDeadline] = deadline
	}
	return container.Summary{ID: id, Labels: labels}
}

func unix(t time.Time) string {
	return strconv.FormatInt(t.Unix(), 10)
}

func TestCreateSandboxLabelsDeadlineWithGrace(t *testing.T) {
	docker := &fakeDocker{}
	spec := validSpec()

	if _, err := managerAt(docker, fixedNow).CreateSandbox(t.Context(), spec); err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}

	want := unix(fixedNow.Add(spec.TTL + DefaultTTLGrace))
	if got := docker.created.Config.Labels[LabelDeadline]; got != want {
		t.Errorf("deadline label = %q, want %q (now + ttl + %s)", got, want, DefaultTTLGrace)
	}
}

func TestReapExpiredDestroysOnlyExpiredOrUnboundedSandboxes(t *testing.T) {
	docker := &fakeDocker{sandboxes: []container.Summary{
		sandboxWithDeadline("past", unix(fixedNow.Add(-time.Second))),
		sandboxWithDeadline("exactly-now", unix(fixedNow)),
		sandboxWithDeadline("future", unix(fixedNow.Add(time.Minute))),
		sandboxWithDeadline("no-deadline", ""),
		sandboxWithDeadline("garbage", "tomorrow"),
	}}

	destroyed, err := managerAt(docker, fixedNow).ReapExpired(t.Context())
	if err != nil {
		t.Fatalf("ReapExpired() error = %v", err)
	}
	want := []string{"remove past", "remove exactly-now", "remove no-deadline", "remove garbage"}
	if !slices.Equal(docker.calls, want) || destroyed != len(want) {
		t.Errorf("destroyed %d, calls = %v, want %v", destroyed, docker.calls, want)
	}
	if !docker.listed.All || !docker.listed.Filters["label"][LabelSandbox+"=true"] {
		t.Errorf("list options = %+v, want all containers with the sandbox label", docker.listed)
	}
}

func TestReapExpiredContinuesAfterAFailedDestroy(t *testing.T) {
	removeErr := errors.New("daemon busy")
	docker := &fakeDocker{removeErr: removeErr, sandboxes: []container.Summary{
		sandboxWithDeadline("a", unix(fixedNow.Add(-time.Minute))),
		sandboxWithDeadline("b", unix(fixedNow.Add(-time.Minute))),
	}}

	_, err := managerAt(docker, fixedNow).ReapExpired(t.Context())
	if !errors.Is(err, removeErr) {
		t.Errorf("ReapExpired() error = %v, want it to wrap %v", err, removeErr)
	}
	if want := []string{"remove a", "remove b"}; !slices.Equal(docker.calls, want) {
		t.Errorf("calls = %v, want %v (one failure must not stop the rest)", docker.calls, want)
	}
}
