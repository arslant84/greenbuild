//go:build integration

package agentclient_test

// architecture.md, task 11: after a session, storage holds a file with the commands and timings.
// Real agent and sandbox, /attach over WebSocket, Azurite as Blob Storage.

import (
	"bufio"
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/azuritetest"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/sessionlog"
	"github.com/coder/websocket"
)

const logWait = 15 * time.Second

func TestSessionLogIsSavedAfterAttachOnRealDocker(t *testing.T) {
	agentclient.EnsureImage(t)
	opts := agentclient.EngineOptions(t, "localhost", agentclient.NewBundle(t, "localhost"))
	agentclient.StartRealAgent(t, opts)
	client := agentclient.Dialed(t, opts)
	sandboxID := createSandbox(t, client)
	connection := azuritetest.Start(t, sessionlog.Container)
	url := startRecordedAttach(t, client, connection)

	ctx, cancel := context.WithTimeout(t.Context(), terminalTimeout)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, url+"?token="+signToken(t, sandboxID), nil)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	defer func() { _ = conn.CloseNow() }()
	send(t, ctx, conn, "echo $((6*7))-from-the-sandbox\n")
	readUntil(t, ctx, conn, "42-from-the-sandbox")
	send(t, ctx, conn, "exit 4\n")
	readExitCode(t, ctx, conn)
	_, _, _ = conn.Read(ctx) // answers the close handshake, which ends the session

	saved := awaitLog(t, azuritetest.Blob{Connection: connection, Container: sessionlog.Container, Name: sessionlog.Name("att-1", time.Now())})
	var commands []string
	for _, event := range saved {
		if event.Type == sessionlog.EventCommand {
			commands = append(commands, event.Data)
		}
	}
	if want := []string{"echo $((6*7))-from-the-sandbox", "exit 4"}; !slices.Equal(commands, want) {
		t.Errorf("commands = %q, want %q", commands, want)
	}
	checkTimeline(t, saved, sandboxID)
}

func startRecordedAttach(t *testing.T, client *agentclient.Client, connection string) string {
	t.Helper()
	store, err := sessionlog.NewBlobStore(connection)
	if err != nil {
		t.Fatal(err)
	}
	log := sessionlog.New(store)
	handler := newAttachHandler(t, client)
	handler.RecordSessions(func(granted attachtoken.Attach) attach.Recording {
		return log.Start(granted.AttemptID, granted.SandboxID)
	})
	return serveAttach(t, handler)
}

// awaitLog waits for the log: it is saved after the WebSocket closes.
func awaitLog(t *testing.T, blob azuritetest.Blob) []sessionlog.Event {
	t.Helper()
	deadline := time.Now().Add(logWait)
	content, _, err := azuritetest.Download(t.Context(), blob)
	for err != nil && time.Now().Before(deadline) {
		time.Sleep(200 * time.Millisecond)
		content, _, err = azuritetest.Download(t.Context(), blob)
	}
	if err != nil {
		t.Fatalf("no session log within %v: %v", logWait, err)
	}
	var events []sessionlog.Event
	scanner := bufio.NewScanner(strings.NewReader(content))
	for scanner.Scan() {
		var event sessionlog.Event
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			t.Fatalf("line %q: %v", scanner.Text(), err)
		}
		events = append(events, event)
	}
	return events
}

// checkTimeline wants start first, end last, exit code 4, and time that never runs backwards.
func checkTimeline(t *testing.T, events []sessionlog.Event, sandboxID string) {
	t.Helper()
	if len(events) < 2 || events[0].Type != sessionlog.EventStart || events[0].SandboxID != sandboxID || events[len(events)-1].Type != sessionlog.EventEnd {
		t.Fatalf("events = %+v, want start for %s first and end last", events, sandboxID)
	}
	exited := slices.IndexFunc(events, func(event sessionlog.Event) bool {
		return event.Type == sessionlog.EventExit && event.ExitCode != nil && *event.ExitCode == 4
	})
	sorted := slices.IsSortedFunc(events, func(a, b sessionlog.Event) int { return int(a.ElapsedMS - b.ElapsedMS) })
	if exited < 0 || !sorted {
		t.Errorf("events = %+v, want exit 4 and ascending ms", events)
	}
}
