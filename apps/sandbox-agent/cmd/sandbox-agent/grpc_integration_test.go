//go:build integration

package main

import (
	"crypto/tls"
	"crypto/x509"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/agentserver"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/devpki"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/moby/moby/client"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// architecture.md, task 6: a client with a certificate calls every method; without one it is refused.
// Runs against the real Docker daemon; SANDBOX_TEST_RUNTIME picks runc (local) or runsc (CI).

const (
	e2eImage   = "alpine:3"
	e2eTimeout = 60 * time.Second
	scriptPath = "/opt/greenbuild/hello.sh"
)

func runtimeUnderTest() string {
	if runtime := os.Getenv("SANDBOX_TEST_RUNTIME"); runtime != "" {
		return runtime
	}
	return config.RuntimeRunc
}

// startAgent serves the real agent API over mTLS and returns its address and the certificates.
func startAgent(t *testing.T) (string, devpki.Bundle) {
	t.Helper()
	bundle, err := devpki.Generate(devpki.Options{ServerHosts: []string{"localhost"}, ClientName: "sandbox-engine", ValidFor: time.Hour})
	if err != nil {
		t.Fatalf("generate certificates: %v", err)
	}
	dir := t.TempDir()
	if err := bundle.WriteFiles(dir); err != nil {
		t.Fatalf("write certificates: %v", err)
	}
	docker, err := client.New(client.FromEnv)
	if err != nil {
		t.Fatalf("docker client: %v", err)
	}
	t.Cleanup(func() { _ = docker.Close() })

	cfg := config.Config{GRPCAddr: "127.0.0.1:0", TLS: config.TLSFiles{
		CA:   filepath.Join(dir, devpki.CAFile),
		Cert: filepath.Join(dir, devpki.ServerCertFile),
		Key:  filepath.Join(dir, devpki.ServerKeyFile),
	}}
	stop, addr, err := startGRPC(cfg, agentserver.FromManager(sandbox.NewManager(docker, runtimeUnderTest())))
	if err != nil {
		t.Fatalf("startGRPC() error = %v", err)
	}
	t.Cleanup(stop)
	return addr, bundle
}

func dial(t *testing.T, addr string, bundle devpki.Bundle, withCertificate bool) agentv1.SandboxAgentClient {
	t.Helper()
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(bundle.CA.CertPEM)
	tlsConfig := &tls.Config{RootCAs: roots, ServerName: "localhost", MinVersion: tls.VersionTLS13}
	if withCertificate {
		pair, err := tls.X509KeyPair(bundle.Client.CertPEM, bundle.Client.KeyPEM)
		if err != nil {
			t.Fatalf("client key pair: %v", err)
		}
		tlsConfig.Certificates = []tls.Certificate{pair}
	}
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	if err != nil {
		t.Fatalf("grpc client: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return agentv1.NewSandboxAgentClient(conn)
}

func TestClientWithoutCertificateIsRefusedOnRealDocker(t *testing.T) {
	addr, bundle := startAgent(t)

	if _, err := dial(t, addr, bundle, false).Health(t.Context(), &agentv1.HealthRequest{}); err == nil {
		t.Fatal("Health() without a client certificate succeeded, want refusal")
	}
}

func TestClientWithCertificateCallsEveryMethodOnRealDocker(t *testing.T) {
	addr, bundle := startAgent(t)
	agent := dial(t, addr, bundle, true)
	ctx := t.Context()

	if health, err := agent.Health(ctx, &agentv1.HealthRequest{}); err != nil || health.GetStatus() != "ok" {
		t.Fatalf("Health() = %v, %v", health, err)
	}
	created, err := agent.CreateSandbox(ctx, &agentv1.CreateSandboxRequest{
		Image: e2eImage, Command: []string{"sleep", "300"}, CpuMillis: 500, MemoryBytes: 64 << 20, TtlSeconds: 300,
	})
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	id := created.GetSandboxId()

	script := []byte("#!/bin/sh\necho hello from copyin\n")
	if _, err := agent.CopyIn(ctx, &agentv1.CopyInRequest{SandboxId: id, Path: scriptPath, Content: script, Mode: 0o755}); err != nil {
		t.Fatalf("CopyIn() error = %v", err)
	}

	output, exitCode := runInTerminal(t, agent, id, scriptPath+"; exit 4\n")
	if !strings.Contains(output, "hello from copyin") || exitCode != 4 {
		t.Errorf("Exec output %q, exit %d; want the script's greeting and exit 4", output, exitCode)
	}

	if _, err := agent.Destroy(ctx, &agentv1.DestroyRequest{SandboxId: id}); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}
}

// runInTerminal opens an Exec stream, types input, and collects output until the exit code arrives.
func runInTerminal(t *testing.T, agent agentv1.SandboxAgentClient, id, input string) (string, int32) {
	t.Helper()
	stream, err := agent.Exec(t.Context())
	if err != nil {
		t.Fatalf("Exec() error = %v", err)
	}
	size := &agentv1.TerminalSize{Rows: 24, Cols: 80}
	messages := []*agentv1.ExecRequest{
		{Payload: &agentv1.ExecRequest_Start{Start: &agentv1.ExecStart{SandboxId: id, Size: size}}},
		{Payload: &agentv1.ExecRequest_Stdin{Stdin: []byte(input)}},
	}
	for _, message := range messages {
		if err := stream.Send(message); err != nil {
			t.Fatalf("send: %v", err)
		}
	}

	var output strings.Builder
	deadline := time.Now().Add(e2eTimeout)
	for time.Now().Before(deadline) {
		resp, err := stream.Recv()
		if err != nil {
			t.Fatalf("receive: %v (output so far %q)", err, output.String())
		}
		if _, done := resp.GetPayload().(*agentv1.ExecResponse_ExitCode); done {
			return output.String(), resp.GetExitCode()
		}
		output.Write(resp.GetOutput())
	}
	t.Fatalf("no exit code within %s; output %q", e2eTimeout, output.String())
	return "", 0
}
