package attach

import (
	"context"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/coder/websocket"
)

type fakeRecording struct {
	mu       sync.Mutex
	attach   attachtoken.Attach
	inputs   []string
	exits    []int32
	finished chan struct{}
}

func (r *fakeRecording) Input(data []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.inputs = append(r.inputs, string(data))
}

func (r *fakeRecording) Exit(code int32) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.exits = append(r.exits, code)
}

func (r *fakeRecording) Finish(context.Context) { close(r.finished) }

func TestAttachRecordsInputAndExit(t *testing.T) {
	session := newFakeSession()
	recording := &fakeRecording{finished: make(chan struct{})}
	handler := NewHandler(fakeTokens{}, func(context.Context, string, agentclient.TerminalSize) (Session, error) {
		return session, nil
	}, nil)
	handler.RecordSessions(func(attach attachtoken.Attach) Recording {
		recording.attach = attach
		return recording
	})
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	conn, ctx := attached(t, "ws"+strings.TrimPrefix(server.URL, "http")+"?token="+goodToken)

	mustWrite(t, conn, websocket.MessageBinary, "ls\r")
	mustWrite(t, conn, websocket.MessageText, `{"type":"resize","rows":40,"cols":120}`)
	session.waitForCalls(t, 2)
	session.events <- agentclient.Event{Exited: true, ExitCode: 3}
	expectMessage(t, ctx, conn, websocket.MessageText, `{"type":"exit","code":3}`)
	// Reading answers the server's close handshake, which ends the session.
	_, _, _ = conn.Read(ctx)
	select {
	case <-recording.finished:
	case <-time.After(testTimeout):
		t.Fatal("the recording was not finished after the session")
	}

	recording.mu.Lock()
	defer recording.mu.Unlock()
	if recording.attach.AttemptID != "att-1" || !slices.Equal(recording.inputs, []string{"ls\r"}) || !slices.Equal(recording.exits, []int32{3}) {
		t.Errorf("recorded %+v inputs %q exits %v; want att-1, the keystrokes only and exit 3", recording.attach, recording.inputs, recording.exits)
	}
}
