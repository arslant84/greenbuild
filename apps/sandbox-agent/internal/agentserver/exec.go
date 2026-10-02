package agentserver

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/grpc/codes"
)

// outputChunkBytes bounds one output message; large enough for a full screen redraw.
const outputChunkBytes = 32 << 10

// Terminal is an interactive shell in a sandbox, as sandbox.Terminal provides it.
type Terminal interface {
	Input() io.Writer
	Output() io.Reader
	Resize(ctx context.Context, size sandbox.TerminalSize) error
	ExitCode(ctx context.Context) (int, error)
	Close()
}

// Exec runs an interactive terminal over the stream. The first request must be ExecStart;
// then stdin and resize requests flow in while output flows out, and the last response
// carries the exit code. Closing the request stream ends the session.
func (s *Server) Exec(stream agentv1.SandboxAgent_ExecServer) error {
	first, err := stream.Recv()
	if err != nil {
		return grpcError(codes.Canceled, "stream closed before ExecStart")
	}
	start := first.GetStart()
	if start == nil || start.GetSandboxId() == "" {
		return grpcError(codes.InvalidArgument, "the first message must be ExecStart with a sandbox_id")
	}

	ctx := stream.Context()
	terminal, err := s.sandboxes.OpenTerminal(ctx, start.GetSandboxId(), toTerminalSize(start.GetSize()))
	if err != nil {
		return toStatus("open terminal", err)
	}
	defer terminal.Close()

	go forwardInput(ctx, stream, terminal)
	if err := forwardOutput(stream, terminal.Output()); err != nil {
		return err
	}
	code, err := terminal.ExitCode(ctx)
	if err != nil {
		return toStatus("read exit code", err)
	}
	if err := stream.Send(&agentv1.ExecResponse{Payload: &agentv1.ExecResponse_ExitCode{ExitCode: int32(code)}}); err != nil {
		return fmt.Errorf("send exit code: %w", err)
	}
	return nil
}

// forwardInput passes stdin and resizes to the terminal until the client stops sending;
// then it closes the terminal, which ends the shell and the output stream.
func forwardInput(ctx context.Context, stream agentv1.SandboxAgent_ExecServer, terminal Terminal) {
	defer terminal.Close()
	for {
		req, err := stream.Recv()
		if err != nil {
			return
		}
		switch payload := req.GetPayload().(type) {
		case *agentv1.ExecRequest_Stdin:
			if _, err := terminal.Input().Write(payload.Stdin); err != nil {
				return
			}
		case *agentv1.ExecRequest_Resize:
			if err := terminal.Resize(ctx, toTerminalSize(payload.Resize)); err != nil {
				slog.Warn("resize terminal", "error", err)
			}
		}
	}
}

// forwardOutput sends terminal output until the shell exits or the terminal is closed.
func forwardOutput(stream agentv1.SandboxAgent_ExecServer, output io.Reader) error {
	buffer := make([]byte, outputChunkBytes)
	for {
		n, readErr := output.Read(buffer)
		if n > 0 {
			chunk := &agentv1.ExecResponse{Payload: &agentv1.ExecResponse_Output{Output: append([]byte(nil), buffer[:n]...)}}
			if err := stream.Send(chunk); err != nil {
				return fmt.Errorf("send output: %w", err)
			}
		}
		if readErr == nil {
			continue
		}
		if errors.Is(readErr, io.EOF) || stream.Context().Err() != nil {
			return nil
		}
		// A closed connection after the client stopped sending is the normal end of a session.
		slog.Debug("terminal output ended", "error", readErr)
		return nil
	}
}

func toTerminalSize(size *agentv1.TerminalSize) sandbox.TerminalSize {
	return sandbox.TerminalSize{Rows: uint(size.GetRows()), Cols: uint(size.GetCols())}
}
