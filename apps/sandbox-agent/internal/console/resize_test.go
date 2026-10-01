package console

import (
	"context"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
)

type recordingResizer struct {
	mu    sync.Mutex
	sizes []sandbox.TerminalSize
}

func (r *recordingResizer) Resize(_ context.Context, size sandbox.TerminalSize) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sizes = append(r.sizes, size)
	return nil
}

func (r *recordingResizer) recorded() []sandbox.TerminalSize {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.sizes)
}

func TestWatchResizeForwardsOnlyChanges(t *testing.T) {
	small := sandbox.TerminalSize{Rows: 24, Cols: 80}
	large := sandbox.TerminalSize{Rows: 40, Cols: 120}
	sequence := []sandbox.TerminalSize{small, small, large, large, large}
	var mu sync.Mutex
	next := 0
	current := func() sandbox.TerminalSize {
		mu.Lock()
		defer mu.Unlock()
		size := sequence[min(next, len(sequence)-1)]
		next++
		return size
	}
	target := &recordingResizer{}
	ctx, cancel := context.WithCancel(t.Context())

	done := make(chan struct{})
	go func() {
		WatchResize(ctx, target, current, time.Millisecond)
		close(done)
	}()
	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	if got := target.recorded(); !slices.Equal(got, []sandbox.TerminalSize{large}) {
		t.Errorf("resizes = %v, want exactly one resize to %v", got, large)
	}
}
