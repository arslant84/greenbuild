//go:build integration

package agentclient_test

// architecture.md, task 8: a WebSocket client gets a working terminal in a sandbox:
// browser ↔ /attach ↔ engine ↔ agent (real process) ↔ container.

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"github.com/coder/websocket"
	"github.com/golang-jwt/jwt/v5"
)

const terminalTimeout = 30 * time.Second

var secret = []byte(strings.Repeat("e2e-secret-", 4))

func TestBrowserGetsAWorkingTerminalThroughAttachOnRealDocker(t *testing.T) {
	agentclient.EnsureImage(t)
	opts := agentclient.EngineOptions(t, "localhost", agentclient.NewBundle(t, "localhost"))
	agentclient.StartRealAgent(t, opts)
	client := agentclient.Dialed(t, opts)
	sandboxID := createSandbox(t, client)

	url := startAttach(t, client)
	ctx, cancel := context.WithTimeout(t.Context(), terminalTimeout)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, url+"?rows=24&cols=80&token="+signToken(t, sandboxID), nil)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	defer func() { _ = conn.CloseNow() }()

	// The answer is computed in the shell, so the echoed command line cannot match it.
	send(t, ctx, conn, "echo $((6*7))-from-the-sandbox\n")
	readUntil(t, ctx, conn, "42-from-the-sandbox")
	send(t, ctx, conn, "exit 4\n")
	if code := readExitCode(t, ctx, conn); code != 4 {
		t.Errorf("exit code = %d, want 4", code)
	}
}

func createSandbox(t *testing.T, client *agentclient.Client) string {
	t.Helper()
	id, err := client.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{
		Image: "alpine:3", Command: []string{"sleep", "300"}, CpuMillis: 500, MemoryBytes: 64 << 20, TtlSeconds: 300,
	})
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() { _ = client.Destroy(context.Background(), id) })
	return id
}

func startAttach(t *testing.T, client *agentclient.Client) string {
	t.Helper()
	return serveAttach(t, newAttachHandler(t, client))
}

func newAttachHandler(t *testing.T, client *agentclient.Client) *attach.Handler {
	t.Helper()
	verifier, err := attachtoken.NewVerifier(secret)
	if err != nil {
		t.Fatalf("NewVerifier() error = %v", err)
	}
	open := func(ctx context.Context, sandboxID string, size agentclient.TerminalSize) (attach.Session, error) {
		return client.OpenTerminal(ctx, sandboxID, size)
	}
	return attach.NewHandler(verifier, open, nil)
}

func serveAttach(t *testing.T, handler *attach.Handler) string {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return "ws" + strings.TrimPrefix(server.URL, "http")
}

// signToken issues what the API will issue: HS256, 60 seconds, bound to the sandbox and attempt.
func signToken(t *testing.T, sandboxID string) string {
	t.Helper()
	now := time.Now()
	claims := attachtoken.Claims{SandboxID: sandboxID, AttemptID: "att-1", RegisteredClaims: jwt.RegisteredClaims{
		Subject: "user-1", Audience: jwt.ClaimStrings{attachtoken.Audience},
		IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(attachtoken.MaxLifetime)),
	}}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return token
}

func send(t *testing.T, ctx context.Context, conn *websocket.Conn, keys string) {
	t.Helper()
	if err := conn.Write(ctx, websocket.MessageBinary, []byte(keys)); err != nil {
		t.Fatalf("send %q: %v", keys, err)
	}
}

func readUntil(t *testing.T, ctx context.Context, conn *websocket.Conn, want string) {
	t.Helper()
	var output strings.Builder
	for !strings.Contains(output.String(), want) {
		kind, data, err := conn.Read(ctx)
		if err != nil || kind != websocket.MessageBinary {
			t.Fatalf("waiting for %q: %v (output so far %q)", want, err, output.String())
		}
		output.Write(data)
	}
}

func readExitCode(t *testing.T, ctx context.Context, conn *websocket.Conn) int32 {
	t.Helper()
	for {
		kind, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("waiting for the exit frame: %v", err)
		}
		if kind != websocket.MessageText {
			continue
		}
		var frame struct {
			Type string `json:"type"`
			Code int32  `json:"code"`
		}
		if err := json.Unmarshal(data, &frame); err != nil || frame.Type != "exit" {
			t.Fatalf("unexpected control frame %q", data)
		}
		return frame.Code
	}
}
