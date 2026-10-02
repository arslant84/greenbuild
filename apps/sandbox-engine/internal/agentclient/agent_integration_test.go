//go:build integration

package agentclient

// architecture.md, task 7: the control plane creates and destroys a sandbox through the agent.
// The real agent runs as a separate process (built from apps/sandbox-agent at test time, never
// imported), on the Docker daemon from the environment. SANDBOX_TEST_RUNTIME: runc locally, runsc in CI.

import (
	"context"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/devpki"
)

const (
	e2eImage        = "alpine:3"
	agentModuleDir  = "../../../sandbox-agent"
	agentStartLimit = 60 * time.Second
	retryInterval   = 250 * time.Millisecond
)

func runtimeUnderTest() string {
	if runtime := os.Getenv("SANDBOX_TEST_RUNTIME"); runtime != "" {
		return runtime
	}
	return "runc"
}

func TestEngineCreatesAndDestroysASandboxThroughTheAgentOnRealDocker(t *testing.T) {
	ensureImage(t)
	bundle := newBundle(t, "localhost")
	opts := engineOptions(t, freeAddr(t), "localhost", bundle)
	startRealAgent(t, opts)
	client := dialed(t, opts)

	id, err := client.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{
		Image: e2eImage, Command: []string{"sleep", "300"}, CpuMillis: 500, MemoryBytes: 64 << 20, TtlSeconds: 300,
	})
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	if got := docker(t, "inspect", "-f", "{{.State.Running}} {{index .Config.Labels \"greenbuild.sandbox\"}}", id); got != "true true" {
		t.Errorf("sandbox %s: running and labelled = %q, want \"true true\"", id, got)
	}

	if err := client.Destroy(t.Context(), id); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}
	if _, err := exec.CommandContext(t.Context(), "docker", "inspect", id).Output(); err == nil {
		t.Errorf("sandbox %s still exists after Destroy", id)
	}
}

// startRealAgent builds the agent binary and runs it with the agent side of opts' certificates.
func startRealAgent(t *testing.T, opts Options) {
	t.Helper()
	binary := filepath.Join(t.TempDir(), "sandbox-agent")
	if runtime.GOOS == "windows" {
		binary += ".exe"
	}
	// Built inside the agent's own module: Go refuses packages outside the current one.
	build := exec.CommandContext(t.Context(), "go", "build", "-o", binary, "./cmd/sandbox-agent")
	build.Dir = agentModuleDir
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build agent: %v\n%s", err, out)
	}

	certDir := filepath.Dir(opts.CAFile)
	agent := exec.Command(binary)
	agent.Env = append(os.Environ(),
		"SANDBOX_AGENT_RUNTIME="+runtimeUnderTest(),
		"SANDBOX_AGENT_HEALTH_ADDR="+freeAddr(t),
		"SANDBOX_AGENT_GRPC_ADDR="+opts.Addr,
		"SANDBOX_AGENT_TLS_CA="+opts.CAFile,
		"SANDBOX_AGENT_TLS_CERT="+filepath.Join(certDir, devpki.ServerCertFile),
		"SANDBOX_AGENT_TLS_KEY="+filepath.Join(certDir, devpki.ServerKeyFile),
	)
	agent.Stdout, agent.Stderr = os.Stdout, os.Stderr
	if err := agent.Start(); err != nil {
		t.Fatalf("start agent: %v", err)
	}
	t.Cleanup(func() {
		_ = agent.Process.Kill()
		_ = agent.Wait()
	})
	waitForAgent(t, opts)
}

func waitForAgent(t *testing.T, opts Options) {
	t.Helper()
	client := dialed(t, opts)
	deadline := time.Now().Add(agentStartLimit)
	for {
		ctx, cancel := context.WithTimeout(t.Context(), time.Second)
		err := client.Health(ctx)
		cancel()
		if err == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("agent did not answer Health over mTLS within %s: %v", agentStartLimit, err)
		}
		time.Sleep(retryInterval)
	}
}

// freeAddr returns a loopback address with a port that was free a moment ago.
func freeAddr(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("find a free port: %v", err)
	}
	defer func() { _ = listener.Close() }()
	return listener.Addr().String()
}

func ensureImage(t *testing.T) {
	t.Helper()
	if exec.CommandContext(t.Context(), "docker", "image", "inspect", e2eImage).Run() == nil {
		return
	}
	docker(t, "pull", "-q", e2eImage)
}

func docker(t *testing.T, args ...string) string {
	t.Helper()
	out, err := exec.CommandContext(t.Context(), "docker", args...).CombinedOutput()
	if err != nil {
		t.Fatalf("docker %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return strings.TrimSpace(string(out))
}
