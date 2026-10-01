package sandbox

import (
	"context"
	"fmt"
	"slices"
	"testing"

	"github.com/moby/moby/client"
)

func (f *fakeDocker) ExecResize(_ context.Context, execID string, options client.ExecResizeOptions) (client.ExecResizeResult, error) {
	f.resizes = append(f.resizes, fmt.Sprintf("%s %dx%d", execID, options.Width, options.Height))
	return client.ExecResizeResult{}, nil
}

func TestOpenTerminalStartsInteractiveShellWithPTY(t *testing.T) {
	docker := &fakeDocker{}

	terminal, err := NewManager(docker, "runsc").OpenTerminal(t.Context(), fakeContainerID, TerminalSize{Rows: 24, Cols: 80})
	if err != nil {
		t.Fatalf("OpenTerminal() error = %v", err)
	}
	defer terminal.Close()

	got := docker.lastExec
	if !slices.Equal(got.Cmd, []string{"/bin/sh"}) {
		t.Errorf("Cmd = %v, want [/bin/sh]", got.Cmd)
	}
	if !got.TTY || !got.AttachStdin || !got.AttachStdout || !got.AttachStderr {
		t.Errorf("TTY/stdin/stdout/stderr = %v/%v/%v/%v, want all true", got.TTY, got.AttachStdin, got.AttachStdout, got.AttachStderr)
	}
	if got.ConsoleSize != (client.ConsoleSize{Height: 24, Width: 80}) {
		t.Errorf("ConsoleSize = %+v, want 80x24", got.ConsoleSize)
	}
	if !slices.Contains(got.Env, "TERM=xterm-256color") {
		t.Errorf("Env = %v, want TERM=xterm-256color", got.Env)
	}
	if want := []string{terminal.execID + " 80x24"}; !slices.Equal(docker.resizes, want) {
		t.Errorf("resizes = %v, want %v: the size must be applied after start, or gVisor leaves the PTY sizeless", docker.resizes, want)
	}
}

func TestTerminalResizeAndExitCodeUseItsExec(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{"/bin/sh": {exitCode: 3}}}
	terminal, err := NewManager(docker, "runsc").OpenTerminal(t.Context(), fakeContainerID, TerminalSize{Rows: 24, Cols: 80})
	if err != nil {
		t.Fatalf("OpenTerminal() error = %v", err)
	}
	defer terminal.Close()

	if err := terminal.Resize(t.Context(), TerminalSize{Rows: 40, Cols: 120}); err != nil {
		t.Fatalf("Resize() error = %v", err)
	}
	if want := []string{terminal.execID + " 80x24", terminal.execID + " 120x40"}; !slices.Equal(docker.resizes, want) {
		t.Errorf("resizes = %v, want %v", docker.resizes, want)
	}
	if code, err := terminal.ExitCode(t.Context()); err != nil || code != 3 {
		t.Errorf("ExitCode() = %d, %v; want 3, nil", code, err)
	}
}
