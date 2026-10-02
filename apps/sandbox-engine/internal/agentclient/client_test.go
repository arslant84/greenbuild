package agentclient

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"net"
	"path/filepath"
	"sync"
	"testing"
	"time"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/arslant84/greenbuild/packages/devpki"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

const callTimeout = 5 * time.Second

// fakeAgent records what the engine asks for.
type fakeAgent struct {
	agentv1.UnimplementedSandboxAgentServer
	mu        sync.Mutex
	created   *agentv1.CreateSandboxRequest
	destroyed string
}

func (f *fakeAgent) Health(context.Context, *agentv1.HealthRequest) (*agentv1.HealthResponse, error) {
	return &agentv1.HealthResponse{Status: "ok"}, nil
}

func (f *fakeAgent) CreateSandbox(_ context.Context, req *agentv1.CreateSandboxRequest) (*agentv1.CreateSandboxResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.created = req
	return &agentv1.CreateSandboxResponse{SandboxId: "sbx-1"}, nil
}

func (f *fakeAgent) Destroy(_ context.Context, req *agentv1.DestroyRequest) (*agentv1.DestroyResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.destroyed = req.GetSandboxId()
	return &agentv1.DestroyResponse{}, nil
}

// startFakeAgent serves fakeAgent with the agent side of an mTLS setup from bundle.
func startFakeAgent(t *testing.T, bundle devpki.Bundle) (string, *fakeAgent) {
	t.Helper()
	pair, err := tls.X509KeyPair(bundle.Server.CertPEM, bundle.Server.KeyPEM)
	if err != nil {
		t.Fatalf("agent key pair: %v", err)
	}
	clientCAs := x509.NewCertPool()
	clientCAs.AppendCertsFromPEM(bundle.CA.CertPEM)
	tlsConfig := &tls.Config{Certificates: []tls.Certificate{pair}, ClientCAs: clientCAs,
		ClientAuth: tls.RequireAndVerifyClientCert, MinVersion: tls.VersionTLS13}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	agent := &fakeAgent{}
	server := grpc.NewServer(grpc.Creds(credentials.NewTLS(tlsConfig)))
	agentv1.RegisterSandboxAgentServer(server, agent)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	return listener.Addr().String(), agent
}

func newBundle(t *testing.T, hosts ...string) devpki.Bundle {
	t.Helper()
	bundle, err := devpki.Generate(devpki.Options{ServerHosts: hosts, ClientName: "sandbox-engine", ValidFor: time.Hour})
	if err != nil {
		t.Fatalf("generate certificates: %v", err)
	}
	return bundle
}

// engineOptions writes the engine side of bundle to disk, as a deployment would.
func engineOptions(t *testing.T, addr, serverName string, bundle devpki.Bundle) Options {
	t.Helper()
	dir := t.TempDir()
	if err := bundle.WriteFiles(dir); err != nil {
		t.Fatalf("write certificates: %v", err)
	}
	return Options{
		Addr: addr, ServerName: serverName,
		CAFile:   filepath.Join(dir, devpki.CAFile),
		CertFile: filepath.Join(dir, devpki.ClientCertFile),
		KeyFile:  filepath.Join(dir, devpki.ClientKeyFile),
	}
}

func dialed(t *testing.T, opts Options) *Client {
	t.Helper()
	client, err := Dial(opts)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	t.Cleanup(func() { _ = client.Close() })
	return client
}

func TestClientCallsTheAgentOverMTLS(t *testing.T) {
	bundle := newBundle(t, "localhost")
	addr, agent := startFakeAgent(t, bundle)
	client := dialed(t, engineOptions(t, addr, "localhost", bundle))
	ctx, cancel := context.WithTimeout(t.Context(), callTimeout)
	defer cancel()

	if err := client.Health(ctx); err != nil {
		t.Fatalf("Health() error = %v", err)
	}
	id, err := client.CreateSandbox(ctx, &agentv1.CreateSandboxRequest{Image: "alpine:3", TtlSeconds: 60})
	if err != nil || id != "sbx-1" {
		t.Fatalf("CreateSandbox() = %q, %v; want sbx-1", id, err)
	}
	if err := client.Destroy(ctx, id); err != nil {
		t.Fatalf("Destroy() error = %v", err)
	}

	agent.mu.Lock()
	defer agent.mu.Unlock()
	if agent.created.GetImage() != "alpine:3" || agent.destroyed != "sbx-1" {
		t.Errorf("agent saw create %v and destroy %q", agent.created, agent.destroyed)
	}
}

func TestClientRefusesAgentsItShouldNotTrust(t *testing.T) {
	trusted := newBundle(t, "localhost")
	cases := map[string]struct {
		agentBundle devpki.Bundle
		serverName  string
	}{
		"certificate for another name": {trusted, "sandbox-agent-7"},
		"certificate from another CA":  {newBundle(t, "localhost"), "localhost"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			addr, _ := startFakeAgent(t, tc.agentBundle)
			client := dialed(t, engineOptions(t, addr, tc.serverName, trusted))
			ctx, cancel := context.WithTimeout(t.Context(), callTimeout)
			defer cancel()
			if err := client.Health(ctx); err == nil {
				t.Error("Health() succeeded against an agent the engine must not trust")
			}
		})
	}
}

func TestDialFailsOnMissingFiles(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.pem")
	if _, err := Dial(Options{Addr: "127.0.0.1:1", ServerName: "localhost", CAFile: missing, CertFile: missing, KeyFile: missing}); err == nil {
		t.Error("Dial() error = nil, want missing certificate files reported")
	}
}
