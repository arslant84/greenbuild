package sessionlog

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeStore records saved chunks; the flusher calls it from its own goroutine. err fails every
// save, failFirst only the first few.
type fakeStore struct {
	mu        sync.Mutex
	names     []string
	contents  [][]byte
	err       error
	failFirst int
}

func (s *fakeStore) Append(_ context.Context, name string, content []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.names = append(s.names, name)
	if s.failFirst > 0 {
		s.failFirst--
		return errors.New("blob service unavailable")
	}
	s.contents = append(s.contents, content)
	return s.err
}

// saved is every chunk saved so far, joined in order.
func (s *fakeStore) saved() []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	return bytes.Join(s.contents, nil)
}

// waitForSave waits until a chunk containing want is saved, as an engine that keeps running would.
func waitForSave(t *testing.T, store *fakeStore, want string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !bytes.Contains(store.saved(), []byte(want)) {
		if time.Now().After(deadline) {
			t.Fatalf("no chunk with %q saved in time", want)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// tickingClock starts at a fixed time and moves one second per reading.
func tickingClock() func() time.Time {
	current := time.Date(2026, 10, 2, 9, 0, 0, 0, time.UTC)
	return func() time.Time {
		now := current
		current = current.Add(time.Second)
		return now
	}
}

func events(t *testing.T, content []byte) []Event {
	t.Helper()
	var parsed []Event
	scanner := bufio.NewScanner(bytes.NewReader(content))
	scanner.Buffer(nil, 2*maxLogBytes)
	for scanner.Scan() {
		var event Event
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			t.Fatalf("line %q: %v", scanner.Text(), err)
		}
		parsed = append(parsed, event)
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("read log: %v", err)
	}
	return parsed
}

func types(parsed []Event) []string {
	var names []string
	for _, event := range parsed {
		names = append(names, event.Type)
	}
	return names
}

func TestRecordingSavesCommandsWithTimings(t *testing.T) {
	store := &fakeStore{}
	log := &Log{store: store, now: tickingClock(), flushEvery: flushInterval}
	recording := log.Start("att-1", "sbx-1")
	recording.Input([]byte("cat /etc/ngnix"))
	recording.Input([]byte("\x7f\x7f\x7finx.conf\r"))
	recording.Exit(0)
	recording.Finish(t.Context())
	recording.Finish(t.Context())

	if len(store.names) != 1 || store.names[0] != "2026/10/att-1.jsonl" {
		t.Fatalf("saved %v, want once to 2026/10/att-1.jsonl", store.names)
	}
	got := events(t, store.contents[0])
	if want := []string{EventStart, EventInput, EventInput, EventCommand, EventExit, EventEnd}; !slices.Equal(types(got), want) {
		t.Fatalf("event types = %v, want %v", types(got), want)
	}
	if got[3].Data != "cat /etc/nginx.conf" || got[3].ElapsedMS != 3000 {
		t.Errorf("command = %+v, want cat /etc/nginx.conf at 3000 ms", got[3])
	}
	checkStartAndExit(t, got[0], got[4])
}

func checkStartAndExit(t *testing.T, start, exit Event) {
	t.Helper()
	if start.AttemptID != "att-1" || start.SandboxID != "sbx-1" || start.ElapsedMS != 0 {
		t.Errorf("start = %+v, want att-1 and sbx-1 at 0 ms", start)
	}
	if exit.ExitCode == nil || *exit.ExitCode != 0 {
		t.Errorf("exit = %+v, want code 0", exit)
	}
}

func TestLineBufferHandlesTerminalKeys(t *testing.T) {
	cases := map[string]struct {
		input string
		want  []string
	}{
		"two lines":             {"ls\rpwd\n", []string{"ls", "pwd"}},
		"arrow keys ignored":    {"ls\x1b[A\x1b[D -l\r", []string{"ls -l"}},
		"application arrows":    {"ls\x1bOA\r", []string{"ls"}},
		"ctrl-c clears":         {"rm -rf /\x03echo ok\r", []string{"echo ok"}},
		"multibyte backspace":   {"echo é\x7fe\r", []string{"echo e"}},
		"bracketed paste kept":  {"\x1b[200~kubectl get pods\x1b[201~\r", []string{"kubectl get pods"}},
		"empty lines skipped":   {"\r  \r", nil},
		"backspace on empty":    {"\x7f\x7fls\r", []string{"ls"}},
		"alt key dropped":       {"\x1bbls\r", []string{"ls"}},
		"unfinished line saved": {"ls", nil},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			var buffer lineBuffer
			if got := buffer.feed([]byte(tc.input)); !slices.Equal(got, tc.want) {
				t.Errorf("feed(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestRecordingIsCapped(t *testing.T) {
	store := &fakeStore{}
	recording := (&Log{store: store, now: tickingClock(), flushEvery: flushInterval}).Start("att-1", "sbx-1")
	paste := []byte(strings.Repeat("x", 64<<10))
	for range 40 {
		recording.Input(paste)
	}
	recording.Finish(t.Context())

	content := store.saved()
	if len(content) > maxLogBytes+1024 {
		t.Errorf("log is %d bytes, want about %d at most", len(content), maxLogBytes)
	}
	names := types(events(t, content))
	truncated := len(slices.DeleteFunc(slices.Clone(names), func(name string) bool { return name != EventTruncated }))
	if truncated != 1 || names[len(names)-1] != EventEnd {
		t.Errorf("event types %v; want one truncated and end last", names)
	}
}

func TestFailedSaveDoesNotPanic(t *testing.T) {
	store := &fakeStore{err: errors.New("blob service unavailable")}
	recording := New(store).Start("att-1", "sbx-1")
	recording.Input([]byte("ls\r"))
	recording.Finish(t.Context())
	if len(store.names) != 1 {
		t.Errorf("save attempts = %d, want 1", len(store.names))
	}
}

// Task 49a: what was typed is saved while the session runs, so an engine that dies loses little.
func TestRecordingSavesOnTheIntervalBeforeTheSessionEnds(t *testing.T) {
	store := &fakeStore{}
	recording := (&Log{store: store, now: tickingClock(), flushEvery: 10 * time.Millisecond}).Start("att-1", "sbx-1")
	t.Cleanup(func() { recording.Finish(context.Background()) })
	recording.Input([]byte("ls"))

	waitForSave(t, store, "\"command\"")
	if want := []string{EventStart, EventInput, EventCommand}; !slices.Equal(types(events(t, store.saved())), want) {
		t.Errorf("saved before the end = %v, want %v", types(events(t, store.saved())), want)
	}
}

func TestRecordingSavesOnceAChunkIsFull(t *testing.T) {
	store := &fakeStore{}
	recording := (&Log{store: store, now: tickingClock(), flushEvery: time.Hour}).Start("att-1", "sbx-1")
	recording.Input([]byte(strings.Repeat("x", flushBytes)))

	waitForSave(t, store, strings.Repeat("x", flushBytes))
	recording.Input([]byte("pwd"))
	recording.Finish(t.Context())
	if got := types(events(t, store.saved())); !slices.Equal(got, []string{EventStart, EventInput, EventInput, EventCommand, EventEnd}) {
		t.Errorf("event types = %v, want the whole session once, in order", got)
	}
}

func TestFailedChunkIsSavedLaterInOrder(t *testing.T) {
	store := &fakeStore{failFirst: 1}
	recording := (&Log{store: store, now: tickingClock(), flushEvery: 10 * time.Millisecond}).Start("att-1", "sbx-1")
	recording.Input([]byte("ls"))

	waitForSave(t, store, "\"ls\"")
	recording.Input([]byte("pwd"))
	recording.Finish(t.Context())
	got := events(t, store.saved())
	if types(got)[0] != EventStart || got[len(got)-1].Type != EventEnd || len(got) != 6 {
		t.Errorf("event types = %v, want start … end with nothing lost or doubled", types(got))
	}
}
