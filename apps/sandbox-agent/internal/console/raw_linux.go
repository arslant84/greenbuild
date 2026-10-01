package console

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	"golang.org/x/sys/unix"
)

// MakeRaw puts stdin into raw mode, the equivalent of cfmakeraw, and returns a function that restores it.
func MakeRaw(stdin, _ *os.File) (func(), error) {
	fd := int(stdin.Fd())
	saved, err := unix.IoctlGetTermios(fd, unix.TCGETS)
	if err != nil {
		return nil, fmt.Errorf("stdin is not a terminal: %w", err)
	}

	raw := *saved
	raw.Iflag &^= unix.IGNBRK | unix.BRKINT | unix.PARMRK | unix.ISTRIP | unix.INLCR | unix.IGNCR | unix.ICRNL | unix.IXON
	raw.Oflag &^= unix.OPOST
	raw.Lflag &^= unix.ECHO | unix.ECHONL | unix.ICANON | unix.ISIG | unix.IEXTEN
	raw.Cflag &^= unix.CSIZE | unix.PARENB
	raw.Cflag |= unix.CS8
	raw.Cc[unix.VMIN] = 1
	raw.Cc[unix.VTIME] = 0
	if err := unix.IoctlSetTermios(fd, unix.TCSETS, &raw); err != nil {
		return nil, fmt.Errorf("set raw mode: %w", err)
	}

	return func() {
		if err := unix.IoctlSetTermios(fd, unix.TCSETS, saved); err != nil {
			slog.Warn("restore terminal mode; run `reset`", "error", err)
		}
	}, nil
}

func Size(stdout *os.File) (sandbox.TerminalSize, bool) {
	size, err := unix.IoctlGetWinsize(int(stdout.Fd()), unix.TIOCGWINSZ)
	if err != nil || size.Row == 0 || size.Col == 0 {
		return sandbox.TerminalSize{}, false
	}
	return sandbox.TerminalSize{Rows: uint(size.Row), Cols: uint(size.Col)}, true
}
