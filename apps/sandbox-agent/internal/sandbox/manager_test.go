package sandbox

import (
	"context"
	"errors"
	"slices"
	"testing"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/client"
)

const fakeContainerID = "container-1"

type fakeDocker struct {
	calls     []string
	created   client.ContainerCreateOptions
	createErr error
	startErr  error
	removeErr error
	// execs maps a command's first argument to how the fake runs it; exec IDs map back to it.
	execs   map[string]fakeExec
	execIDs map[string]string
	// sandboxes is what ContainerList returns; listed records the options it was called with.
	sandboxes []container.Summary
	listed    client.ContainerListOptions
}

func (f *fakeDocker) ContainerCreate(_ context.Context, options client.ContainerCreateOptions) (client.ContainerCreateResult, error) {
	f.calls = append(f.calls, "create")
	f.created = options
	return client.ContainerCreateResult{ID: fakeContainerID}, f.createErr
}

func (f *fakeDocker) ContainerStart(_ context.Context, id string, _ client.ContainerStartOptions) (client.ContainerStartResult, error) {
	f.calls = append(f.calls, "start "+id)
	return client.ContainerStartResult{}, f.startErr
}

func (f *fakeDocker) ContainerRemove(_ context.Context, id string, _ client.ContainerRemoveOptions) (client.ContainerRemoveResult, error) {
	f.calls = append(f.calls, "remove "+id)
	return client.ContainerRemoveResult{}, f.removeErr
}

func TestCreateSandboxCreatesThenStarts(t *testing.T) {
	docker := &fakeDocker{}

	id, err := NewManager(docker, "runsc").CreateSandbox(t.Context(), validSpec())
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	if id != fakeContainerID {
		t.Errorf("id = %q, want %q", id, fakeContainerID)
	}
	if want := []string{"create", "start " + fakeContainerID}; !slices.Equal(docker.calls, want) {
		t.Errorf("calls = %v, want %v", docker.calls, want)
	}
	if docker.created.HostConfig.Runtime != "runsc" {
		t.Errorf("runtime = %q, want runsc", docker.created.HostConfig.Runtime)
	}
}

func TestCreateSandboxRejectsInvalidSpecWithoutCallingDocker(t *testing.T) {
	docker := &fakeDocker{}

	_, err := NewManager(docker, "runsc").CreateSandbox(t.Context(), Spec{})
	if !errors.Is(err, ErrInvalidSpec) {
		t.Errorf("error = %v, want ErrInvalidSpec", err)
	}
	if len(docker.calls) != 0 {
		t.Errorf("calls = %v, want none", docker.calls)
	}
}

func TestCreateSandboxRemovesContainerWhenStartFails(t *testing.T) {
	startErr := errors.New("runtime not found")
	docker := &fakeDocker{startErr: startErr}

	_, err := NewManager(docker, "runsc").CreateSandbox(t.Context(), validSpec())
	if !errors.Is(err, startErr) {
		t.Errorf("error = %v, want it to wrap %v", err, startErr)
	}
	want := []string{"create", "start " + fakeContainerID, "remove " + fakeContainerID}
	if !slices.Equal(docker.calls, want) {
		t.Errorf("calls = %v, want %v", docker.calls, want)
	}
}

func TestDestroyTreatsMissingContainerAsDestroyed(t *testing.T) {
	docker := &fakeDocker{removeErr: cerrdefs.ErrNotFound}

	if err := NewManager(docker, "runsc").Destroy(t.Context(), fakeContainerID); err != nil {
		t.Errorf("Destroy() error = %v, want nil", err)
	}
}

func TestDestroyReportsOtherErrors(t *testing.T) {
	removeErr := errors.New("daemon unavailable")
	docker := &fakeDocker{removeErr: removeErr}

	if err := NewManager(docker, "runsc").Destroy(t.Context(), fakeContainerID); !errors.Is(err, removeErr) {
		t.Errorf("Destroy() error = %v, want it to wrap %v", err, removeErr)
	}
}
