package sandbox

import (
	"context"
	"fmt"
	"io"

	"github.com/moby/moby/api/pkg/stdcopy"
	"github.com/moby/moby/client"
)

const (
	// maxExecOutputBytes keeps the end of a command's output for error messages,
	// so a noisy script cannot grow the agent's memory.
	maxExecOutputBytes = 4096
	rawStreamMediaType = "application/vnd.docker.raw-stream"
)

type execResult struct {
	exitCode int
	output   string
}

// exec runs cmd in the container as its default user, waits for it to finish,
// and returns its exit code and the tail of its combined output.
func (m *Manager) exec(ctx context.Context, id string, cmd []string) (execResult, error) {
	created, err := m.docker.ExecCreate(ctx, id, client.ExecCreateOptions{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	})
	if err != nil {
		return execResult{}, fmt.Errorf("create exec %v in sandbox %s: %w", cmd, id, err)
	}

	attached, err := m.docker.ExecAttach(ctx, created.ID, client.ExecAttachOptions{})
	if err != nil {
		return execResult{}, fmt.Errorf("start exec %v in sandbox %s: %w", cmd, id, err)
	}
	defer attached.Close()

	output := &tailBuffer{limit: maxExecOutputBytes}
	if err := copyExecOutput(output, attached.HijackedResponse); err != nil {
		return execResult{}, fmt.Errorf("read output of %v in sandbox %s: %w", cmd, id, err)
	}

	inspected, err := m.docker.ExecInspect(ctx, created.ID, client.ExecInspectOptions{})
	if err != nil {
		return execResult{}, fmt.Errorf("inspect exec %v in sandbox %s: %w", cmd, id, err)
	}
	return execResult{exitCode: inspected.ExitCode, output: output.String()}, nil
}

// copyExecOutput reads the attached stream until the command exits. Without a TTY Docker
// multiplexes stdout and stderr into one framed stream, unless it says the stream is raw.
func copyExecOutput(dst io.Writer, stream client.HijackedResponse) error {
	if mediaType, ok := stream.MediaType(); ok && mediaType == rawStreamMediaType {
		if _, err := io.Copy(dst, stream.Reader); err != nil {
			return fmt.Errorf("copy raw stream: %w", err)
		}
		return nil
	}
	if _, err := stdcopy.StdCopy(dst, dst, stream.Reader); err != nil {
		return fmt.Errorf("demultiplex stream: %w", err)
	}
	return nil
}

// tailBuffer keeps only the last limit bytes written to it.
type tailBuffer struct {
	limit int
	data  []byte
}

func (b *tailBuffer) Write(p []byte) (int, error) {
	b.data = append(b.data, p...)
	if excess := len(b.data) - b.limit; excess > 0 {
		b.data = b.data[excess:]
	}
	return len(p), nil
}

func (b *tailBuffer) String() string {
	return string(b.data)
}
