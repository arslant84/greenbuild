package agentserver

import (
	"context"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc/codes"
)

// Run executes a command without a terminal; a non-zero exit is a result, not an error.
func (s *Server) Run(ctx context.Context, req *agentv1.RunRequest) (*agentv1.RunResponse, error) {
	if req.GetSandboxId() == "" {
		return nil, grpcError(codes.InvalidArgument, "sandbox_id is required")
	}
	command := sandbox.Command{
		Argv:    req.GetCommand(),
		Timeout: time.Duration(req.GetTimeoutSeconds()) * time.Second,
	}
	result, err := s.sandboxes.Run(ctx, req.GetSandboxId(), command)
	if err != nil {
		return nil, toStatus("run command", err)
	}
	return &agentv1.RunResponse{
		ExitCode:   int32(result.ExitCode),
		OutputTail: []byte(result.OutputTail),
		TimedOut:   result.TimedOut,
	}, nil
}
