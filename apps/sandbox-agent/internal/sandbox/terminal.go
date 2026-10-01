package sandbox

import (
	"context"
	"fmt"
	"io"

	"github.com/moby/moby/client"
)

const (
	// terminalShell exists in every challenge image (all are Alpine-based).
	terminalShell = "/bin/sh"
	terminalType  = "TERM=xterm-256color"
)

// TerminalSize is a terminal window in character cells.
type TerminalSize struct {
	Rows uint
	Cols uint
}

// Terminal is an interactive shell with a pseudo-terminal inside a sandbox.
// With a TTY, Docker sends stdout and stderr as one raw stream, as a real terminal would.
type Terminal struct {
	docker DockerAPI
	execID string
	stream client.HijackedResponse
}

// OpenTerminal starts a shell with a PTY of the given size in the sandbox.
func (m *Manager) OpenTerminal(ctx context.Context, id string, size TerminalSize) (*Terminal, error) {
	console := client.ConsoleSize{Height: size.Rows, Width: size.Cols}
	created, err := m.docker.ExecCreate(ctx, id, client.ExecCreateOptions{
		Cmd:          []string{terminalShell},
		Env:          []string{terminalType},
		TTY:          true,
		ConsoleSize:  console,
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
	})
	if err != nil {
		return nil, fmt.Errorf("create terminal in sandbox %s: %w", id, err)
	}

	attached, err := m.docker.ExecAttach(ctx, created.ID, client.ExecAttachOptions{TTY: true, ConsoleSize: console})
	if err != nil {
		return nil, fmt.Errorf("attach terminal in sandbox %s: %w", id, err)
	}
	terminal := &Terminal{docker: m.docker, execID: created.ID, stream: attached.HijackedResponse}

	// gVisor ignores the size given at creation: until a resize arrives the PTY has no size and
	// termios calls fail (stty: "Not a tty"), breaking editors and pagers. The Docker CLI also resizes here.
	if err := terminal.Resize(ctx, size); err != nil {
		terminal.Close()
		return nil, err
	}
	return terminal, nil
}

// Input is what the player types; it goes to the shell's stdin.
func (t *Terminal) Input() io.Writer {
	return t.stream.Conn
}

// Output is everything the shell prints, ending when the shell exits.
func (t *Terminal) Output() io.Reader {
	return t.stream.Reader
}

// Resize changes the PTY size, e.g. when the player resizes their browser window.
func (t *Terminal) Resize(ctx context.Context, size TerminalSize) error {
	if _, err := t.docker.ExecResize(ctx, t.execID, client.ExecResizeOptions{Height: size.Rows, Width: size.Cols}); err != nil {
		return fmt.Errorf("resize terminal %s to %dx%d: %w", t.execID, size.Cols, size.Rows, err)
	}
	return nil
}

// ExitCode returns the shell's exit code. Call it after Output has reached EOF.
func (t *Terminal) ExitCode(ctx context.Context) (int, error) {
	inspected, err := t.docker.ExecInspect(ctx, t.execID, client.ExecInspectOptions{})
	if err != nil {
		return 0, fmt.Errorf("inspect terminal %s: %w", t.execID, err)
	}
	return inspected.ExitCode, nil
}

// Close ends the connection; the shell gets a hangup and exits.
func (t *Terminal) Close() {
	t.stream.Close()
}
