// Package sandbox turns a challenge's resource spec into an isolated container configuration.
package sandbox

import (
	"errors"
	"fmt"
	"slices"

	"github.com/moby/moby/api/types/container"
)

const (
	// PidsLimit caps processes per sandbox (architecture.md: PID limit 256) so a fork bomb cannot exhaust the node.
	PidsLimit int64 = 256

	// LabelSandbox marks every container the agent creates, so orphans can be found and removed.
	LabelSandbox = "greenbuild.sandbox"

	nanoCPUsPerMilliCPU = 1_000_000
	networkNone         = "none"
	dropAllCapabilities = "ALL"
	noNewPrivileges     = "no-new-privileges"
)

// ErrInvalidSpec is wrapped by every validation error returned from Spec.Validate.
var ErrInvalidSpec = errors.New("invalid sandbox spec")

// IsAllowedCapability reports whether a challenge may add capability back after all are dropped.
// All allowed ones are in Docker's default set; anything that reaches the kernel or network stack
// directly (SYS_ADMIN, NET_ADMIN, NET_RAW, SYS_PTRACE, MKNOD, ...) is deliberately absent.
// A switch rather than a package-level slice, so the list cannot be changed at runtime.
func IsAllowedCapability(capability string) bool {
	switch capability {
	case "CHOWN", "DAC_OVERRIDE", "FOWNER", "KILL", "NET_BIND_SERVICE", "SETGID", "SETUID":
		return true
	default:
		return false
	}
}

// Spec describes one sandbox: what to run and how much it may use.
type Spec struct {
	Image   string
	Command []string
	// CPUMillis is the CPU limit in thousandths of a CPU; the manifest value "500m" is 500.
	CPUMillis   int64
	MemoryBytes int64
	// Capabilities come from the challenge manifest, e.g. ["SETUID", "SETGID"]; see IsAllowedCapability.
	Capabilities []string
}

// Validate rejects specs that would start a container without an image or without limits.
func (s Spec) Validate() error {
	if s.Image == "" {
		return fmt.Errorf("%w: image is required", ErrInvalidSpec)
	}
	if s.CPUMillis <= 0 {
		return fmt.Errorf("%w: cpu limit must be positive, got %d", ErrInvalidSpec, s.CPUMillis)
	}
	if s.MemoryBytes <= 0 {
		return fmt.Errorf("%w: memory limit must be positive, got %d", ErrInvalidSpec, s.MemoryBytes)
	}
	for _, capability := range s.Capabilities {
		if !IsAllowedCapability(capability) {
			return fmt.Errorf("%w: capability %q is not allowed", ErrInvalidSpec, capability)
		}
	}
	return nil
}

// ContainerConfig returns the Docker configuration for spec under the given OCI runtime.
// Every sandbox gets the same isolation; only the image, command and limits vary.
func ContainerConfig(spec Spec, runtime string) (*container.Config, *container.HostConfig) {
	pidsLimit := PidsLimit
	config := &container.Config{
		Image:  spec.Image,
		Cmd:    spec.Command,
		Labels: map[string]string{LabelSandbox: "true"},
	}
	hostConfig := &container.HostConfig{
		Runtime:     runtime,
		NetworkMode: networkNone,
		CapDrop:     []string{dropAllCapabilities},
		CapAdd:      slices.Clone(spec.Capabilities),
		SecurityOpt: []string{noNewPrivileges},
		Resources: container.Resources{
			NanoCPUs: spec.CPUMillis * nanoCPUsPerMilliCPU,
			Memory:   spec.MemoryBytes,
			// Equal to Memory: no swap, so the memory limit cannot be bypassed.
			MemorySwap: spec.MemoryBytes,
			PidsLimit:  &pidsLimit,
		},
	}
	return config, hostConfig
}
