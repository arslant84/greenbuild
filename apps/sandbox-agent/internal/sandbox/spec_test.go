package sandbox

import (
	"errors"
	"slices"
	"testing"
	"time"
)

const mebibyte = 1 << 20

func validSpec() Spec {
	return Spec{
		Image:       "alpine:3",
		Command:     []string{"sleep", "infinity"},
		CPUMillis:   500,
		MemoryBytes: 512 * mebibyte,
		TTL:         15 * time.Minute,
	}
}

func TestContainerConfigAppliesIsolation(t *testing.T) {
	_, host := ContainerConfig(validSpec(), "runsc")

	if host.Runtime != "runsc" {
		t.Errorf("Runtime = %q, want runsc", host.Runtime)
	}
	if host.NetworkMode != "none" {
		t.Errorf("NetworkMode = %q, want none", host.NetworkMode)
	}
	if !slices.Equal(host.CapDrop, []string{"ALL"}) {
		t.Errorf("CapDrop = %v, want [ALL]", host.CapDrop)
	}
	if len(host.CapAdd) != 0 {
		t.Errorf("CapAdd = %v, want none when the spec asks for none", host.CapAdd)
	}
	if !slices.Contains(host.SecurityOpt, "no-new-privileges") {
		t.Errorf("SecurityOpt = %v, want no-new-privileges", host.SecurityOpt)
	}
	if host.Privileged {
		t.Error("Privileged = true, want false")
	}
}

func TestContainerConfigAppliesLimits(t *testing.T) {
	_, host := ContainerConfig(validSpec(), "runsc")

	if host.NanoCPUs != 500_000_000 {
		t.Errorf("NanoCPUs = %d, want 500000000 (half a CPU)", host.NanoCPUs)
	}
	if host.Memory != 512*mebibyte {
		t.Errorf("Memory = %d, want %d", host.Memory, 512*mebibyte)
	}
	if host.MemorySwap != host.Memory {
		t.Errorf("MemorySwap = %d, want %d (no swap)", host.MemorySwap, host.Memory)
	}
	if host.PidsLimit == nil || *host.PidsLimit != PidsLimit {
		t.Errorf("PidsLimit = %v, want %d", host.PidsLimit, PidsLimit)
	}
}

func TestContainerConfigSetsImageCommandAndLabel(t *testing.T) {
	config, _ := ContainerConfig(validSpec(), "runc")

	if config.Image != "alpine:3" {
		t.Errorf("Image = %q, want alpine:3", config.Image)
	}
	if !slices.Equal(config.Cmd, []string{"sleep", "infinity"}) {
		t.Errorf("Cmd = %v, want [sleep infinity]", config.Cmd)
	}
	if config.Labels[LabelSandbox] != "true" {
		t.Errorf("label %s = %q, want true", LabelSandbox, config.Labels[LabelSandbox])
	}
}

func TestContainerConfigAddsBackRequestedCapabilitiesOnly(t *testing.T) {
	spec := validSpec()
	spec.Capabilities = []string{"CHOWN", "SETUID", "SETGID"}

	_, host := ContainerConfig(spec, "runsc")

	if !slices.Equal(host.CapDrop, []string{"ALL"}) {
		t.Errorf("CapDrop = %v, want [ALL]", host.CapDrop)
	}
	if !slices.Equal(host.CapAdd, []string{"CHOWN", "SETUID", "SETGID"}) {
		t.Errorf("CapAdd = %v, want [CHOWN SETUID SETGID]", host.CapAdd)
	}
	spec.Capabilities[0] = "SYS_ADMIN"
	if host.CapAdd[0] != "CHOWN" {
		t.Error("CapAdd shares memory with the spec; later changes to the spec leak into the config")
	}
}

func TestValidateRejectsCapabilitiesOutsideTheAllowlist(t *testing.T) {
	for _, capability := range []string{"SYS_ADMIN", "NET_ADMIN", "NET_RAW", "SYS_PTRACE", "MKNOD", "ALL", "CAP_CHOWN", "chown", ""} {
		t.Run(capability, func(t *testing.T) {
			spec := validSpec()
			spec.Capabilities = []string{"SETUID", capability}
			if err := spec.Validate(); !errors.Is(err, ErrInvalidSpec) {
				t.Errorf("Validate() error = %v, want ErrInvalidSpec", err)
			}
		})
	}
}

func TestValidateAcceptsEveryAllowedCapability(t *testing.T) {
	spec := validSpec()
	spec.Capabilities = []string{"CHOWN", "DAC_OVERRIDE", "FOWNER", "KILL", "NET_BIND_SERVICE", "SETGID", "SETUID"}
	if err := spec.Validate(); err != nil {
		t.Errorf("Validate() error = %v, want nil", err)
	}
}

func TestValidateAcceptsValidSpec(t *testing.T) {
	if err := validSpec().Validate(); err != nil {
		t.Errorf("Validate() error = %v, want nil", err)
	}
}

func TestValidateRejectsMissingImageOrLimits(t *testing.T) {
	cases := map[string]func(*Spec){
		"no image":        func(s *Spec) { s.Image = "" },
		"zero cpu":        func(s *Spec) { s.CPUMillis = 0 },
		"negative memory": func(s *Spec) { s.MemoryBytes = -1 },
		"no ttl":          func(s *Spec) { s.TTL = 0 },
	}
	for name, breakSpec := range cases {
		t.Run(name, func(t *testing.T) {
			spec := validSpec()
			breakSpec(&spec)
			if err := spec.Validate(); !errors.Is(err, ErrInvalidSpec) {
				t.Errorf("Validate() error = %v, want ErrInvalidSpec", err)
			}
		})
	}
}
