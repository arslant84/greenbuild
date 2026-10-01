package console

import (
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	"golang.org/x/sys/windows"
)

// MakeRaw passes every key to the sandbox (no local echo or line editing) and lets the console
// interpret the escape sequences the shell sends. It returns a function that restores both modes.
func MakeRaw(stdin, stdout *os.File) (func(), error) {
	inHandle, outHandle := windows.Handle(stdin.Fd()), windows.Handle(stdout.Fd())
	var inMode, outMode uint32
	if err := windows.GetConsoleMode(inHandle, &inMode); err != nil {
		return nil, fmt.Errorf("stdin is not a console: %w", err)
	}
	if err := windows.GetConsoleMode(outHandle, &outMode); err != nil {
		return nil, fmt.Errorf("stdout is not a console: %w", err)
	}

	rawIn := inMode&^(windows.ENABLE_ECHO_INPUT|windows.ENABLE_LINE_INPUT|windows.ENABLE_PROCESSED_INPUT) |
		windows.ENABLE_VIRTUAL_TERMINAL_INPUT
	if err := windows.SetConsoleMode(inHandle, rawIn); err != nil {
		return nil, fmt.Errorf("set raw input mode: %w", err)
	}
	if err := windows.SetConsoleMode(outHandle, outMode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING); err != nil {
		return nil, errors.Join(fmt.Errorf("enable escape sequences: %w", err), windows.SetConsoleMode(inHandle, inMode))
	}

	return func() {
		if err := errors.Join(windows.SetConsoleMode(inHandle, inMode), windows.SetConsoleMode(outHandle, outMode)); err != nil {
			slog.Warn("restore console mode; run `reset` or reopen the terminal", "error", err)
		}
	}, nil
}

// Size returns the visible console window, not the scrollback buffer.
func Size(stdout *os.File) (sandbox.TerminalSize, bool) {
	var info windows.ConsoleScreenBufferInfo
	if err := windows.GetConsoleScreenBufferInfo(windows.Handle(stdout.Fd()), &info); err != nil {
		return sandbox.TerminalSize{}, false
	}
	rows := info.Window.Bottom - info.Window.Top + 1
	cols := info.Window.Right - info.Window.Left + 1
	if rows <= 0 || cols <= 0 {
		return sandbox.TerminalSize{}, false
	}
	return sandbox.TerminalSize{Rows: uint(rows), Cols: uint(cols)}, true
}
