// Package sessionlog records what a player typed in a sandbox terminal, with timings, for the
// anti-cheat signals in architecture.md (paste_large, idle_then_solve, no_exploration). The log
// goes to Blob Storage only, never to the application log.
package sessionlog

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"
)

const (
	// maxLogBytes bounds one session; typing never comes near it, a paste loop could.
	maxLogBytes   = 1 << 20
	uploadTimeout = 10 * time.Second
	// A session is saved in chunks every flushInterval, or once flushBytes are waiting, so an engine
	// that dies loses at most that much of it (task 49a).
	flushInterval = 10 * time.Second
	flushBytes    = 64 << 10
)

// Event types, one per JSONL line.
const (
	EventStart     = "start"
	EventInput     = "input"
	EventCommand   = "command"
	EventExit      = "exit"
	EventTruncated = "truncated"
	EventEnd       = "end"
)

// Event is one line of the log. There is no user id: the attempt links to the user in the database.
type Event struct {
	Time time.Time `json:"t"`
	// ElapsedMS counts from the start of the session, so pauses need no date arithmetic.
	ElapsedMS int64  `json:"ms"`
	Type      string `json:"type"`
	AttemptID string `json:"attempt_id,omitempty"`
	SandboxID string `json:"sandbox_id,omitempty"`
	Data      string `json:"data,omitempty"`
	ExitCode  *int32 `json:"exit_code,omitempty"`
}

// Store appends a chunk of a session to the named log; later chunks and reconnects add to the same one.
type Store interface {
	Append(ctx context.Context, name string, content []byte) error
}

// Log starts recordings that are saved to one Store.
type Log struct {
	store      Store
	now        func() time.Time
	flushEvery time.Duration
}

// New returns a Log that saves to store.
func New(store Store) *Log {
	return &Log{store: store, now: time.Now, flushEvery: flushInterval}
}

// Name is where an attempt's log goes inside the sessions container (architecture.md:
// sessions/{yyyy}/{mm}/{attempt_id}.jsonl).
func Name(attemptID string, at time.Time) string {
	return at.UTC().Format("2006/01/") + attemptID + ".jsonl"
}

// Start begins recording one terminal session and saving it in chunks until Finish.
func (l *Log) Start(attemptID, sandboxID string) *Recording {
	started := l.now()
	r := &Recording{
		store: l.store, now: l.now, name: Name(attemptID, started), started: started,
		wake: make(chan struct{}, 1), done: make(chan struct{}), flusherDone: make(chan struct{}),
	}
	r.write(Event{Type: EventStart, AttemptID: attemptID, SandboxID: sandboxID}, started)
	go r.flushLoop(l.flushEvery)
	return r
}

// Recording is one session's log. Input and Exit may be called from different goroutines.
type Recording struct {
	mu      sync.Mutex
	store   Store
	now     func() time.Time
	name    string
	started time.Time
	// pending holds what is not saved yet; size counts the whole session, for maxLogBytes.
	pending  bytes.Buffer
	size     int
	line     lineBuffer
	full     bool
	finished bool
	// flushMu keeps chunks in order: one save at a time.
	flushMu     sync.Mutex
	wake        chan struct{}
	done        chan struct{}
	flusherDone chan struct{}
}

// Input records keystrokes or a paste as the browser sent them, and every line they complete.
func (r *Recording) Input(data []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.add(Event{Type: EventInput, Data: string(data)})
	for _, command := range r.line.feed(data) {
		r.add(Event{Type: EventCommand, Data: command})
	}
}

// Exit records the shell's exit code.
func (r *Recording) Exit(code int32) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.add(Event{Type: EventExit, ExitCode: &code})
}

// Finish ends the recording and saves what is left; later calls do nothing. A failed save is logged
// without the content: that chunk is lost, the player's attempt is not.
func (r *Recording) Finish(ctx context.Context) {
	r.mu.Lock()
	if r.finished {
		r.mu.Unlock()
		return
	}
	r.write(Event{Type: EventEnd}, r.now())
	r.finished = true
	r.mu.Unlock()

	close(r.done)
	<-r.flusherDone
	r.flush(ctx)
}

// flushLoop saves pending chunks every interval, or sooner once flushBytes are waiting, until Finish.
func (r *Recording) flushLoop(interval time.Duration) {
	defer close(r.flusherDone)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-r.done:
			return
		case <-ticker.C:
		case <-r.wake:
		}
		r.flush(context.Background())
	}
}

// flush appends the pending bytes to the store. A failed append puts them back in front of what came
// since, so the next flush retries them in order.
func (r *Recording) flush(ctx context.Context) {
	r.flushMu.Lock()
	defer r.flushMu.Unlock()
	r.mu.Lock()
	chunk := bytes.Clone(r.pending.Bytes())
	r.pending.Reset()
	r.mu.Unlock()
	if len(chunk) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, uploadTimeout)
	defer cancel()
	if err := r.store.Append(ctx, r.name, chunk); err != nil {
		slog.Error("save session log", "name", r.name, "error", err)
		r.mu.Lock()
		rest := bytes.Clone(r.pending.Bytes())
		r.pending.Reset()
		r.pending.Write(chunk)
		r.pending.Write(rest)
		r.mu.Unlock()
	}
}

// add keeps the log under maxLogBytes; past it, one truncated event marks the gap.
func (r *Recording) add(event Event) {
	if r.full || r.finished {
		return
	}
	if r.size >= maxLogBytes-len(event.Data) {
		r.full = true
		r.write(Event{Type: EventTruncated}, r.now())
		return
	}
	r.write(event, r.now())
}

// write appends one line to the pending bytes and wakes the flusher once flushBytes are waiting.
func (r *Recording) write(event Event, now time.Time) {
	event.Time = now.UTC()
	event.ElapsedMS = now.Sub(r.started).Milliseconds()
	line, err := json.Marshal(event)
	if err != nil {
		slog.Error("encode session event", "type", event.Type, "error", err)
		return
	}
	r.pending.Write(append(line, '\n'))
	r.size += len(line) + 1
	if r.pending.Len() >= flushBytes {
		select {
		case r.wake <- struct{}{}:
		default:
		}
	}
}
