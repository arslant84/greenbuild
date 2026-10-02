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
	// maxLogBytes bounds one session in memory; typing never comes near it, a paste loop could.
	maxLogBytes   = 1 << 20
	uploadTimeout = 10 * time.Second
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

// Store appends a finished session to the named log; reconnects add to the same one.
type Store interface {
	Append(ctx context.Context, name string, content []byte) error
}

// Log starts recordings that are saved to one Store.
type Log struct {
	store Store
	now   func() time.Time
}

// New returns a Log that saves to store.
func New(store Store) *Log {
	return &Log{store: store, now: time.Now}
}

// Name is where an attempt's log goes inside the sessions container (architecture.md:
// sessions/{yyyy}/{mm}/{attempt_id}.jsonl).
func Name(attemptID string, at time.Time) string {
	return at.UTC().Format("2006/01/") + attemptID + ".jsonl"
}

// Start begins recording one terminal session.
func (l *Log) Start(attemptID, sandboxID string) *Recording {
	started := l.now()
	r := &Recording{store: l.store, now: l.now, name: Name(attemptID, started), started: started}
	r.write(Event{Type: EventStart, AttemptID: attemptID, SandboxID: sandboxID}, started)
	return r
}

// Recording is one session's log. Input and Exit may be called from different goroutines.
type Recording struct {
	mu       sync.Mutex
	store    Store
	now      func() time.Time
	name     string
	started  time.Time
	content  bytes.Buffer
	line     lineBuffer
	full     bool
	finished bool
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

// Finish ends the recording and saves it; later calls do nothing. A failed save is logged
// without the content: the session is lost, the player's attempt is not.
func (r *Recording) Finish(ctx context.Context) {
	r.mu.Lock()
	if r.finished {
		r.mu.Unlock()
		return
	}
	r.write(Event{Type: EventEnd}, r.now())
	r.finished = true
	content := bytes.Clone(r.content.Bytes())
	r.mu.Unlock()

	ctx, cancel := context.WithTimeout(ctx, uploadTimeout)
	defer cancel()
	if err := r.store.Append(ctx, r.name, content); err != nil {
		slog.Error("save session log", "name", r.name, "error", err)
	}
}

// add keeps the log under maxLogBytes; past it, one truncated event marks the gap.
func (r *Recording) add(event Event) {
	if r.full || r.finished {
		return
	}
	if r.content.Len() >= maxLogBytes-len(event.Data) {
		r.full = true
		r.write(Event{Type: EventTruncated}, r.now())
		return
	}
	r.write(event, r.now())
}

func (r *Recording) write(event Event, now time.Time) {
	event.Time = now.UTC()
	event.ElapsedMS = now.Sub(r.started).Milliseconds()
	line, err := json.Marshal(event)
	if err != nil {
		slog.Error("encode session event", "type", event.Type, "error", err)
		return
	}
	r.content.Write(append(line, '\n'))
}
