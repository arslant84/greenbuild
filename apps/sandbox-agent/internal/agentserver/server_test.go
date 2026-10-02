package agentserver

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
)

type fakeSandboxes struct {
	calls     []string
	spec      sandbox.Spec
	createErr error
	setupErr  error
	// terminal is what OpenTerminal returns; nil makes it fail.
	terminal     Terminal
	terminalSize sandbox.TerminalSize
}

func (f *fakeSandboxes) CreateSandbox(_ context.Context, spec sandbox.Spec) (string, error) {
	f.calls = append(f.calls, "create")
	f.spec = spec
	return "sbx-1", f.createErr
}

func (f *fakeSandboxes) RunSetup(_ context.Context, id string, seed uint64) error {
	f.calls = append(f.calls, fmt.Sprintf("setup %s %d", id, seed))
	return f.setupErr
}

func (f *fakeSandboxes) CopyIn(_ context.Context, id string, file sandbox.File) error {
	f.calls = append(f.calls, fmt.Sprintf("copy %s %s %o %q", id, file.Path, file.Mode, file.Content))
	if err := file.Validate(); err != nil {
		return fmt.Errorf("fake copy: %w", err)
	}
	return nil
}

func TestCopyInPassesTheFileToTheSandbox(t *testing.T) {
	fake := &fakeSandboxes{}
	req := &agentv1.CopyInRequest{SandboxId: "sbx-1", Path: "/opt/greenbuild/check.sh", Content: []byte("exit 0"), Mode: 0o755}

	if _, err := New(fake).CopyIn(t.Context(), req); err != nil {
		t.Fatalf("CopyIn() error = %v", err)
	}
	if want := []string{`copy sbx-1 /opt/greenbuild/check.sh 755 "exit 0"`}; !slices.Equal(fake.calls, want) {
		t.Errorf("calls = %v, want %v", fake.calls, want)
	}
}

func TestCopyInRejectsBadRequests(t *testing.T) {
	cases := map[string]*agentv1.CopyInRequest{
		"no sandbox":    {Path: "/opt/check.sh", Mode: 0o755},
		"relative path": {SandboxId: "sbx-1", Path: "check.sh", Mode: 0o755},
		"setuid mode":   {SandboxId: "sbx-1", Path: "/opt/check.sh", Mode: 0o4755},
	}
	for name, req := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := New(&fakeSandboxes{}).CopyIn(t.Context(), req); status.Code(err) != codes.InvalidArgument {
				t.Errorf("code = %v, want InvalidArgument", status.Code(err))
			}
		})
	}
}

func (f *fakeSandboxes) Destroy(_ context.Context, id string) error {
	f.calls = append(f.calls, "destroy "+id)
	return nil
}

func request(seed *uint64) *agentv1.CreateSandboxRequest {
	return &agentv1.CreateSandboxRequest{
		Image: "challenge@sha256:abc", Command: []string{"sleep", "infinity"},
		CpuMillis: 500, MemoryBytes: 512 << 20, Capabilities: []string{"SETUID"},
		TtlSeconds: 900, SetupSeed: seed,
	}
}

func TestCreateSandboxMapsRequestToSpec(t *testing.T) {
	fake := &fakeSandboxes{}

	resp, err := New(fake).CreateSandbox(t.Context(), request(nil))
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	if resp.GetSandboxId() != "sbx-1" {
		t.Errorf("sandbox_id = %q, want sbx-1", resp.GetSandboxId())
	}
	want := sandbox.Spec{Image: "challenge@sha256:abc", Command: []string{"sleep", "infinity"},
		CPUMillis: 500, MemoryBytes: 512 << 20, Capabilities: []string{"SETUID"}, TTL: 15 * time.Minute}
	if fake.spec.Image != want.Image || fake.spec.TTL != want.TTL || fake.spec.CPUMillis != want.CPUMillis ||
		fake.spec.MemoryBytes != want.MemoryBytes || !slices.Equal(fake.spec.Capabilities, want.Capabilities) {
		t.Errorf("spec = %+v, want %+v", fake.spec, want)
	}
	if !slices.Equal(fake.calls, []string{"create"}) {
		t.Errorf("calls = %v, want only create (no seed, no setup)", fake.calls)
	}
}

func TestCreateSandboxRunsSetupForSeedZero(t *testing.T) {
	fake := &fakeSandboxes{}

	if _, err := New(fake).CreateSandbox(t.Context(), request(proto.Uint64(0))); err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	if !slices.Equal(fake.calls, []string{"create", "setup sbx-1 0"}) {
		t.Errorf("calls = %v, want create then setup with seed 0", fake.calls)
	}
}

func TestCreateSandboxDestroysSandboxWhenSetupFails(t *testing.T) {
	fake := &fakeSandboxes{setupErr: fmt.Errorf("%w: exited 1: secret puzzle detail", sandbox.ErrSetupFailed)}

	_, err := New(fake).CreateSandbox(t.Context(), request(proto.Uint64(42)))
	if status.Code(err) != codes.FailedPrecondition {
		t.Errorf("code = %v, want FailedPrecondition", status.Code(err))
	}
	if strings.Contains(err.Error(), "secret puzzle detail") {
		t.Error("setup output leaked to the caller; it may reveal how the challenge is broken")
	}
	if !slices.Equal(fake.calls, []string{"create", "setup sbx-1 42", "destroy sbx-1"}) {
		t.Errorf("calls = %v, want the half-made sandbox destroyed", fake.calls)
	}
}

func TestCreateSandboxMapsErrorsToCodes(t *testing.T) {
	cases := map[string]struct {
		err  error
		want codes.Code
	}{
		"invalid spec": {fmt.Errorf("create: %w", sandbox.ErrInvalidSpec), codes.InvalidArgument},
		"docker down":  {errors.New("dial unix /var/run/docker.sock: connection refused"), codes.Internal},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := New(&fakeSandboxes{createErr: tc.err}).CreateSandbox(t.Context(), request(nil))
			if status.Code(err) != tc.want {
				t.Errorf("code = %v, want %v", status.Code(err), tc.want)
			}
			if tc.want == codes.Internal && strings.Contains(err.Error(), "docker.sock") {
				t.Error("internal details leaked to the caller")
			}
		})
	}
}

func TestDestroyRequiresAnID(t *testing.T) {
	fake := &fakeSandboxes{}
	server := New(fake)

	if _, err := server.Destroy(t.Context(), &agentv1.DestroyRequest{}); status.Code(err) != codes.InvalidArgument {
		t.Errorf("empty id: code = %v, want InvalidArgument", status.Code(err))
	}
	if _, err := server.Destroy(t.Context(), &agentv1.DestroyRequest{SandboxId: "sbx-1"}); err != nil {
		t.Errorf("Destroy() error = %v", err)
	}
	if !slices.Equal(fake.calls, []string{"destroy sbx-1"}) {
		t.Errorf("calls = %v, want one destroy", fake.calls)
	}
}

func TestHealth(t *testing.T) {
	if resp, err := New(&fakeSandboxes{}).Health(t.Context(), &agentv1.HealthRequest{}); err != nil || resp.GetStatus() != "ok" {
		t.Errorf("Health() = %v, %v; want ok", resp, err)
	}
}
