// Package agentclient connects the control plane to a sandbox agent. Every connection uses
// mTLS: the engine proves itself with its client certificate and checks the agent's.
package agentclient

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// ErrNoCACertificates is wrapped when the CA file contains no usable certificate.
var ErrNoCACertificates = errors.New("no CA certificates found")

// Options say where the agent is and which files prove both sides.
type Options struct {
	Addr string
	// ServerName must match a name in the agent's certificate.
	ServerName string
	CAFile     string
	CertFile   string
	KeyFile    string
}

// Client calls one sandbox agent.
type Client struct {
	conn  *grpc.ClientConn
	agent agentv1.SandboxAgentClient
}

// Dial prepares a client; the TLS handshake happens on the first call.
func Dial(opts Options) (*Client, error) {
	tlsConfig, err := clientTLS(opts)
	if err != nil {
		return nil, err
	}
	conn, err := grpc.NewClient(opts.Addr, grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)))
	if err != nil {
		return nil, fmt.Errorf("connect to agent %s: %w", opts.Addr, err)
	}
	return &Client{conn: conn, agent: agentv1.NewSandboxAgentClient(conn)}, nil
}

// clientTLS trusts only agents whose certificate the CA signed for ServerName, TLS 1.3 only.
func clientTLS(opts Options) (*tls.Config, error) {
	certificate, err := tls.LoadX509KeyPair(opts.CertFile, opts.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("load engine certificate %s: %w", opts.CertFile, err)
	}
	caPEM, err := os.ReadFile(opts.CAFile)
	if err != nil {
		return nil, fmt.Errorf("read CA %s: %w", opts.CAFile, err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(caPEM) {
		return nil, fmt.Errorf("%w in %s", ErrNoCACertificates, opts.CAFile)
	}
	return &tls.Config{
		Certificates: []tls.Certificate{certificate},
		RootCAs:      roots,
		ServerName:   opts.ServerName,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

// Health checks that the agent answers over mTLS.
func (c *Client) Health(ctx context.Context) error {
	if _, err := c.agent.Health(ctx, &agentv1.HealthRequest{}); err != nil {
		return fmt.Errorf("agent health: %w", err)
	}
	return nil
}

// CreateSandbox asks the agent for a sandbox and returns its id.
func (c *Client) CreateSandbox(ctx context.Context, req *agentv1.CreateSandboxRequest) (string, error) {
	resp, err := c.agent.CreateSandbox(ctx, req)
	if err != nil {
		return "", fmt.Errorf("create sandbox on agent: %w", err)
	}
	return resp.GetSandboxId(), nil
}

// Destroy removes a sandbox; the agent treats an already removed one as success.
func (c *Client) Destroy(ctx context.Context, sandboxID string) error {
	if _, err := c.agent.Destroy(ctx, &agentv1.DestroyRequest{SandboxId: sandboxID}); err != nil {
		return fmt.Errorf("destroy sandbox %s on agent: %w", sandboxID, err)
	}
	return nil
}

// Destroyed is a sandbox the agent destroyed on its own, and why.
type Destroyed struct {
	SandboxID string
	Reason    string
}

// TakeDestroyed returns, once, the sandboxes the agent destroyed on its own since the last call.
func (c *Client) TakeDestroyed(ctx context.Context) ([]Destroyed, error) {
	resp, err := c.agent.TakeDestroyed(ctx, &agentv1.TakeDestroyedRequest{})
	if err != nil {
		return nil, fmt.Errorf("take destroyed sandboxes from agent: %w", err)
	}
	taken := make([]Destroyed, 0, len(resp.GetSandboxes()))
	for _, sandbox := range resp.GetSandboxes() {
		taken = append(taken, Destroyed{SandboxID: sandbox.GetSandboxId(), Reason: sandbox.GetReason()})
	}
	return taken, nil
}

// Close releases the connection.
func (c *Client) Close() error {
	if err := c.conn.Close(); err != nil {
		return fmt.Errorf("close agent connection: %w", err)
	}
	return nil
}
