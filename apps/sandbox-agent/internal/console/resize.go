// Package console puts the local terminal into raw mode and tracks its size, for tools that
// attach it to a sandbox terminal. Raw mode is implemented for Linux and Windows.
package console

import (
	"context"
	"log/slog"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
)

// Resizer is anything whose terminal size can be changed, such as a sandbox terminal.
type Resizer interface {
	Resize(ctx context.Context, size sandbox.TerminalSize) error
}

// WatchResize forwards local window size changes to the sandbox. It polls because Windows
// has no SIGWINCH; a quarter-second lag is fine for a manual tool.
func WatchResize(ctx context.Context, target Resizer, current func() sandbox.TerminalSize, interval time.Duration) {
	last := current()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		size := current()
		if size == last {
			continue
		}
		if err := target.Resize(ctx, size); err != nil {
			slog.Warn("resize sandbox terminal", "error", err)
			continue
		}
		last = size
	}
}
