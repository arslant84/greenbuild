package sandbox

import (
	"context"
	"errors"
	"fmt"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/client"
)

// DockerAPI is the part of the Docker client the manager needs; tests substitute a fake.
type DockerAPI interface {
	ContainerCreate(ctx context.Context, options client.ContainerCreateOptions) (client.ContainerCreateResult, error)
	ContainerStart(ctx context.Context, id string, options client.ContainerStartOptions) (client.ContainerStartResult, error)
	ContainerRemove(ctx context.Context, id string, options client.ContainerRemoveOptions) (client.ContainerRemoveResult, error)
}

// Manager creates and destroys sandbox containers.
type Manager struct {
	docker  DockerAPI
	runtime string
}

// NewManager returns a Manager that runs every sandbox under the given OCI runtime.
func NewManager(docker DockerAPI, runtime string) *Manager {
	return &Manager{docker: docker, runtime: runtime}
}

// CreateSandbox starts an isolated container for spec and returns its ID.
// The image must already be present on the node.
func (m *Manager) CreateSandbox(ctx context.Context, spec Spec) (string, error) {
	if err := spec.Validate(); err != nil {
		return "", fmt.Errorf("create sandbox: %w", err)
	}

	config, hostConfig := ContainerConfig(spec, m.runtime)
	created, err := m.docker.ContainerCreate(ctx, client.ContainerCreateOptions{Config: config, HostConfig: hostConfig})
	if err != nil {
		return "", fmt.Errorf("create sandbox from %s: %w", spec.Image, err)
	}

	if _, err := m.docker.ContainerStart(ctx, created.ID, client.ContainerStartOptions{}); err != nil {
		return "", m.discardUnstarted(ctx, created.ID, err)
	}
	return created.ID, nil
}

// Destroy force-removes the sandbox. A sandbox that is already gone counts as destroyed,
// because the TTL killer and an explicit destroy can race.
func (m *Manager) Destroy(ctx context.Context, id string) error {
	_, err := m.docker.ContainerRemove(ctx, id, client.ContainerRemoveOptions{Force: true, RemoveVolumes: true})
	if err == nil || cerrdefs.IsNotFound(err) {
		return nil
	}
	return fmt.Errorf("destroy sandbox %s: %w", id, err)
}

// discardUnstarted removes a container that was created but failed to start, so it is not orphaned.
func (m *Manager) discardUnstarted(ctx context.Context, id string, startErr error) error {
	startErr = fmt.Errorf("start sandbox %s: %w", id, startErr)
	// Cleanup must run even when the caller's context is what made the start fail.
	if err := m.Destroy(context.WithoutCancel(ctx), id); err != nil {
		return errors.Join(startErr, err)
	}
	return startErr
}
