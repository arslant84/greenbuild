//go:build !linux && !windows

package console

import (
	"errors"
	"os"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
)

// Raw mode is implemented for Linux and Windows only; elsewhere the shell works in line mode.
func MakeRaw(_, _ *os.File) (func(), error) {
	return nil, errors.New("raw mode is not implemented on this OS")
}

func Size(_ *os.File) (sandbox.TerminalSize, bool) {
	return sandbox.TerminalSize{}, false
}
