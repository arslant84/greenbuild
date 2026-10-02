package attach

import (
	"context"
	"errors"
	"fmt"
	"net/http"
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

const (
	goodToken   = "good-token"
	testTimeout = 5 * time.Second
)

type fakeTokens struct{}

func (fakeTokens) Verify(token string) (attachtoken.Attach, error) {
	if token != goodToken {
		return attachtoken.Attach{}, attachtoken.ErrInvalidToken
	}
	return attachtoken.Attach{SandboxID: "sbx-1", AttemptID: "att-1", UserID: "user-1"}, nil
}

// fakeSession is a shell whose output the test feeds through events.
type fakeSession struct {
	events      chan agentclient.Event
	mu          sync.Mutex
	writes      []string
	resizes     []agentclient.TerminalSize
	inputClosed chan struct{}
	closeOnce   sync.Once
}

func newFakeSession() *fakeSession {
	return &fakeSession{events: make(chan agentclient.Event, 4), inputClosed: make(chan struct{})}
}

func (f *fakeSession) Write(input []byte) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.writes = append(f.writes, string(input))
	return len(input), nil
}

func (f *fakeSession) Resize(size agentclient.TerminalSize) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.resizes = append(f.resizes, size)
	return nil
}

func (f *fakeSession) Recv() (agentclient.Event, error) {
	event, ok := <-f.events
	if !ok {
		return agentclient.Event{}, errors.New("stream ended")
	}
	return event, nil
}

func (f *fakeSession) CloseInput() error {
	f.closeOnce.Do(func() { close(f.inputClosed) })
	return nil
}

func (f *fakeSession) Close() {}

// serve starts the handler; opened records the sandbox and size it was asked for.
func serve(t *testing.T, session *fakeSession, openErr error) (string, *[]string) {
	t.Helper()
	var opened []string
	open := func(_ context.Context, sandboxID string, size agentclient.TerminalSize) (Session, error) {
		opened = append(opened, sandboxID+" "+sizeString(size))
		if openErr != nil {
			return nil, openErr
		}
		return session, nil
	}
	server := httptest.NewServer(NewHandler(fakeTokens{}, open, nil))
	t.Cleanup(server.Close)
	return "ws" + strings.TrimPrefix(server.URL, "http"), &opened
}

func sizeString(size agentclient.TerminalSize) string {
	return fmt.Sprintf("%dx%d", size.Cols, size.Rows)
}

func dial(t *testing.T, url string) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), testTimeout)
	defer cancel()
	conn, resp, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		return nil, resp, fmt.Errorf("dial %s: %w", url, err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })
	return conn, resp, nil
}

func TestAttachRefusesABadTokenBeforeUpgrading(t *testing.T) {
	url, opened := serve(t, newFakeSession(), nil)

	_, resp, err := dial(t, url+"?token=forged")
	if err == nil {
		t.Fatal("Dial() succeeded with a forged token")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("response = %v, want 401", resp)
	}
	if len(*opened) != 0 {
		t.Errorf("opened %v, want no terminal for a forged token", *opened)
	}
}

func TestAttachBridgesInputOutputResizeAndExit(t *testing.T) {
	session := newFakeSession()
	url, opened := serve(t, session, nil)
	conn, _, err := dial(t, url+"?token="+goodToken+"&rows=30&cols=100")
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), testTimeout)
	defer cancel()

	mustWrite(t, conn, websocket.MessageBinary, "ls\n")
	mustWrite(t, conn, websocket.MessageText, `{"type":"resize","rows":40,"cols":120}`)
	session.events <- agentclient.Event{Output: []byte("bin  etc\n")}
	expectMessage(t, ctx, conn, websocket.MessageBinary, "bin  etc\n")
	session.events <- agentclient.Event{Exited: true, ExitCode: 3}
	expectMessage(t, ctx, conn, websocket.MessageText, `{"type":"exit","code":3}`)

	if _, _, err := conn.Read(ctx); websocket.CloseStatus(err) != websocket.StatusNormalClosure {
		t.Errorf("after exit: %v, want a normal close", err)
	}
	if !slices.Equal(*opened, []string{"sbx-1 100x30"}) {
		t.Errorf("opened %v, want the token's sandbox at 100x30", *opened)
	}
	session.mu.Lock()
	defer session.mu.Unlock()
	if !slices.Equal(session.writes, []string{"ls\n"}) || !slices.Equal(session.resizes, []agentclient.TerminalSize{{Rows: 40, Cols: 120}}) {
		t.Errorf("writes %q, resizes %v", session.writes, session.resizes)
	}
}

func TestAttachClosesTheShellInputWhenTheBrowserLeaves(t *testing.T) {
	session := newFakeSession()
	url, _ := serve(t, session, nil)
	conn, _, err := dial(t, url+"?token="+goodToken)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}

	_ = conn.Close(websocket.StatusNormalClosure, "tab closed")
	select {
	case <-session.inputClosed:
	case <-time.After(testTimeout):
		t.Fatal("the shell's input was not closed after the browser left")
	}
	close(session.events)
}

func TestAttachReportsATerminalThatCannotOpen(t *testing.T) {
	url, _ := serve(t, nil, errors.New("agent unreachable"))
	conn, _, err := dial(t, url+"?token="+goodToken)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), testTimeout)
	defer cancel()

	if _, _, err := conn.Read(ctx); websocket.CloseStatus(err) != websocket.StatusInternalError {
		t.Errorf("Read() error = %v, want close status %d", err, websocket.StatusInternalError)
	}
}

func TestInitialSizeFallsBackForBadValues(t *testing.T) {
	for _, query := range []string{"", "?rows=0&cols=0", "?rows=abc&cols=-1", "?rows=99999&cols=99999"} {
		request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/attach"+query, nil)
		if got := initialSize(request); got != (agentclient.TerminalSize{Rows: defaultRows, Cols: defaultCols}) {
			t.Errorf("initialSize(%q) = %+v, want 24x80", query, got)
		}
	}
}

func mustWrite(t *testing.T, conn *websocket.Conn, kind websocket.MessageType, data string) {
	t.Helper()
	if err := conn.Write(t.Context(), kind, []byte(data)); err != nil {
		t.Fatalf("write %q: %v", data, err)
	}
}

func expectMessage(t *testing.T, ctx context.Context, conn *websocket.Conn, kind websocket.MessageType, want string) {
	t.Helper()
	got, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("Read() error = %v, want %q", err, want)
	}
	if got != kind || string(data) != want {
		t.Fatalf("Read() = %v %q, want %v %q", got, data, kind, want)
	}
}
