// Package agentserver exposes the sandbox manager to the control plane over gRPC.
package agentserver

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Sandboxes is what the server needs from the sandbox manager.
type Sandboxes interface {
	CreateSandbox(ctx context.Context, spec sandbox.Spec) (string, error)
	RunSetup(ctx context.Context, id string, seed uint64) error
	Destroy(ctx context.Context, id string) error
	CopyIn(ctx context.Context, id string, file sandbox.File) error
	Run(ctx context.Context, id string, command sandbox.Command) (sandbox.RunResult, error)
	OpenTerminal(ctx context.Context, id string, size sandbox.TerminalSize) (Terminal, error)
}

// FromManager adapts the sandbox manager, whose OpenTerminal returns a concrete type, to Sandboxes.
func FromManager(manager *sandbox.Manager) Sandboxes {
	return managerSandboxes{manager}
}

type managerSandboxes struct {
	*sandbox.Manager
}

func (m managerSandboxes) OpenTerminal(ctx context.Context, id string, size sandbox.TerminalSize) (Terminal, error) {
	terminal, err := m.Manager.OpenTerminal(ctx, id, size)
	if err != nil {
		return nil, fmt.Errorf("open terminal: %w", err)
	}
	return terminal, nil
}

// Server implements agentv1.SandboxAgentServer.
type Server struct {
	agentv1.UnimplementedSandboxAgentServer
	sandboxes Sandboxes
}

// New returns a Server backed by sandboxes.
func New(sandboxes Sandboxes) *Server {
	return &Server{sandboxes: sandboxes}
}

// CreateSandbox starts a sandbox and, when a seed is given, runs the challenge setup.
// A sandbox whose setup fails is destroyed, so a failed attempt leaves nothing running.
func (s *Server) CreateSandbox(ctx context.Context, req *agentv1.CreateSandboxRequest) (*agentv1.CreateSandboxResponse, error) {
	spec := sandbox.Spec{
		Image:        req.GetImage(),
		Command:      req.GetCommand(),
		CPUMillis:    req.GetCpuMillis(),
		MemoryBytes:  req.GetMemoryBytes(),
		Capabilities: req.GetCapabilities(),
		TTL:          time.Duration(req.GetTtlSeconds()) * time.Second,
	}
	id, err := s.sandboxes.CreateSandbox(ctx, spec)
	if err != nil {
		return nil, toStatus("create sandbox", err)
	}
	if req.SetupSeed == nil {
		return &agentv1.CreateSandboxResponse{SandboxId: id}, nil
	}

	if err := s.sandboxes.RunSetup(ctx, id, req.GetSetupSeed()); err != nil {
		if destroyErr := s.sandboxes.Destroy(context.WithoutCancel(ctx), id); destroyErr != nil {
			slog.Error("destroy sandbox after failed setup", "sandbox", id, "error", destroyErr)
		}
		return nil, toStatus("run setup", err)
	}
	return &agentv1.CreateSandboxResponse{SandboxId: id}, nil
}

// Destroy removes a sandbox; an unknown or already removed sandbox is not an error.
func (s *Server) Destroy(ctx context.Context, req *agentv1.DestroyRequest) (*agentv1.DestroyResponse, error) {
	if req.GetSandboxId() == "" {
		return nil, grpcError(codes.InvalidArgument, "sandbox_id is required")
	}
	if err := s.sandboxes.Destroy(ctx, req.GetSandboxId()); err != nil {
		return nil, toStatus("destroy sandbox", err)
	}
	return &agentv1.DestroyResponse{}, nil
}

// CopyIn writes a file into a sandbox, e.g. the checker right before a check.
func (s *Server) CopyIn(ctx context.Context, req *agentv1.CopyInRequest) (*agentv1.CopyInResponse, error) {
	if req.GetSandboxId() == "" {
		return nil, grpcError(codes.InvalidArgument, "sandbox_id is required")
	}
	file := sandbox.File{Path: req.GetPath(), Content: req.GetContent(), Mode: os.FileMode(req.GetMode())}
	if err := s.sandboxes.CopyIn(ctx, req.GetSandboxId(), file); err != nil {
		return nil, toStatus("copy file into sandbox", err)
	}
	return &agentv1.CopyInResponse{}, nil
}

// Health answers as long as the agent process serves gRPC.
func (s *Server) Health(_ context.Context, _ *agentv1.HealthRequest) (*agentv1.HealthResponse, error) {
	return &agentv1.HealthResponse{Status: "ok"}, nil
}

// toStatus maps manager errors to gRPC codes. Unexpected errors are logged here and reach the
// caller only as a generic Internal error, so Docker details never leave the node.
func toStatus(action string, err error) error {
	switch {
	case errors.Is(err, sandbox.ErrInvalidSpec), errors.Is(err, sandbox.ErrInvalidFile), errors.Is(err, sandbox.ErrInvalidCommand):
		return grpcError(codes.InvalidArgument, err.Error())
	case errors.Is(err, sandbox.ErrSetupFailed):
		// The script's output stays in the agent log; it may reveal how the challenge is broken.
		slog.Error(action, "error", err)
		return grpcError(codes.FailedPrecondition, "challenge setup failed")
	default:
		slog.Error(action, "error", err)
		return grpcError(codes.Internal, action+" failed")
	}
}

// grpcError builds a gRPC status error. It must reach the transport unwrapped: wrapping would
// hide the status code and every error would arrive as Unknown.
func grpcError(code codes.Code, message string) error {
	return status.Error(code, message) //nolint:wrapcheck // see above; wrapping breaks status.Code
}
