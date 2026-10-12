package sandbox

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/moby/moby/client"
)

// DockerAPI is the part of the Docker client the manager needs; tests substitute a fake.
type DockerAPI interface {
	ContainerCreate(ctx context.Context, options client.ContainerCreateOptions) (client.ContainerCreateResult, error)
	ContainerStart(ctx context.Context, id string, options client.ContainerStartOptions) (client.ContainerStartResult, error)
	ContainerRemove(ctx context.Context, id string, options client.ContainerRemoveOptions) (client.ContainerRemoveResult, error)
	ExecCreate(ctx context.Context, id string, options client.ExecCreateOptions) (client.ExecCreateResult, error)
	ExecAttach(ctx context.Context, execID string, options client.ExecAttachOptions) (client.ExecAttachResult, error)
	ExecInspect(ctx context.Context, execID string, options client.ExecInspectOptions) (client.ExecInspectResult, error)
	ContainerList(ctx context.Context, options client.ContainerListOptions) (client.ContainerListResult, error)
	ExecResize(ctx context.Context, execID string, options client.ExecResizeOptions) (client.ExecResizeResult, error)
	ContainerStats(ctx context.Context, id string, options client.ContainerStatsOptions) (client.ContainerStatsResult, error)
}

// SetupScriptPath is where every challenge image keeps the script that breaks its environment.
const SetupScriptPath = "/opt/greenbuild/setup.sh"

// ErrSetupFailed is wrapped when a challenge's setup script exits non-zero or cannot be removed.
var ErrSetupFailed = errors.New("sandbox setup failed")

// Manager creates and destroys sandbox containers.
type Manager struct {
	docker   DockerAPI
	runtime  string
	ttlGrace time.Duration
	now      func() time.Time
	// destroyed is what the agent destroyed on its own, until the control plane takes it.
	destroyed destroyedJournal
	// stack, when set, is put on every sandbox as LabelStack.
	stack string
}

// NewManager returns a Manager that runs every sandbox under the given OCI runtime.
func NewManager(docker DockerAPI, runtime string) *Manager {
	return &Manager{docker: docker, runtime: runtime, ttlGrace: DefaultTTLGrace, now: time.Now}
}

// SetStack labels the sandboxes created from now on with the local stack's name (config.Config.Stack).
func (m *Manager) SetStack(stack string) {
	m.stack = stack
}

// CreateSandbox starts an isolated container for spec and returns its ID.
// The image must already be present on the node.
func (m *Manager) CreateSandbox(ctx context.Context, spec Spec) (string, error) {
	if err := spec.Validate(); err != nil {
		return "", fmt.Errorf("create sandbox: %w", err)
	}

	config, hostConfig := ContainerConfig(spec, m.runtime)
	config.Labels[LabelDeadline] = strconv.FormatInt(m.deadlineFor(spec).Unix(), 10)
	config.Labels[LabelCPUMillis] = strconv.FormatInt(spec.CPUMillis, 10)
	if m.stack != "" {
		config.Labels[LabelStack] = m.stack
	}
	created, err := m.docker.ContainerCreate(ctx, client.ContainerCreateOptions{Config: config, HostConfig: hostConfig})
	if err != nil {
		return "", fmt.Errorf("create sandbox from %s: %w", spec.Image, err)
	}

	if _, err := m.docker.ContainerStart(ctx, created.ID, client.ContainerStartOptions{}); err != nil {
		return "", m.discardUnstarted(ctx, created.ID, err)
	}
	return created.ID, nil
}

// RunSetup breaks a fresh sandbox for one attempt by running the challenge's setup script with
// the attempt seed, then deletes the script so the player never sees how the environment was broken.
func (m *Manager) RunSetup(ctx context.Context, id string, seed uint64) error {
	setup, err := m.exec(ctx, id, []string{SetupScriptPath, strconv.FormatUint(seed, 10)})
	if err != nil {
		return fmt.Errorf("run setup in sandbox %s: %w", id, err)
	}
	if setup.exitCode != 0 {
		return fmt.Errorf("%w: sandbox %s: setup exited %d: %s", ErrSetupFailed, id, setup.exitCode, setup.output)
	}

	removal, err := m.exec(ctx, id, []string{"rm", "-f", SetupScriptPath})
	if err != nil {
		return fmt.Errorf("remove setup script in sandbox %s: %w", id, err)
	}
	if removal.exitCode != 0 {
		return fmt.Errorf("%w: sandbox %s: removing the setup script exited %d: %s",
			ErrSetupFailed, id, removal.exitCode, removal.output)
	}
	return nil
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
