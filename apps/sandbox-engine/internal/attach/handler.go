// Package attach serves /attach: it checks the attach token, upgrades to a WebSocket and
// bridges the browser's terminal to the sandbox shell behind the agent (architecture.md:
// xterm.js ↔ control plane ↔ agent ↔ container).
package attach

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/coder/websocket"
)

const (
	defaultRows = 24
	defaultCols = 80
	// maxCells keeps an absurd window size from reaching the PTY.
	maxCells = 1000
	// maxMessageBytes bounds one browser message: a paste or a resize, never a file upload.
	maxMessageBytes = 64 << 10
)

// Tokens verifies attach tokens.
type Tokens interface {
	Verify(token string) (attachtoken.Attach, error)
}

// Session is a shell in a sandbox, as agentclient.Terminal provides it.
type Session interface {
	Write(input []byte) (int, error)
	Resize(size agentclient.TerminalSize) error
	Recv() (agentclient.Event, error)
	CloseInput() error
	Close()
}

// OpenSession starts a shell in the named sandbox.
type OpenSession func(ctx context.Context, sandboxID string, size agentclient.TerminalSize) (Session, error)

// Handler serves /attach.
type Handler struct {
	tokens         Tokens
	open           OpenSession
	originPatterns []string
}

// NewHandler returns a handler. originPatterns lists browser origins allowed besides the
// engine's own host, e.g. "greenbuild.dev"; clients without an Origin header are not browsers.
func NewHandler(tokens Tokens, open OpenSession, originPatterns []string) *Handler {
	return &Handler{tokens: tokens, open: open, originPatterns: originPatterns}
}

// ServeHTTP authorizes before upgrading: an invalid token never gets a WebSocket. The token
// decides which sandbox opens, so a user cannot pick someone else's.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	attach, err := h.tokens.Verify(r.URL.Query().Get("token"))
	if err != nil {
		// The URL holds the token, so it is never logged.
		slog.Warn("attach refused", "error", err)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.originPatterns})
	if err != nil {
		slog.Warn("attach upgrade failed", "sandbox", attach.SandboxID, "error", err)
		return
	}
	defer func() { _ = conn.CloseNow() }()
	conn.SetReadLimit(maxMessageBytes)

	session, err := h.open(r.Context(), attach.SandboxID, initialSize(r))
	if err != nil {
		slog.Error("open terminal", "sandbox", attach.SandboxID, "attempt", attach.AttemptID, "error", err)
		_ = conn.Close(websocket.StatusInternalError, "terminal unavailable")
		return
	}
	defer session.Close()

	bridge(r.Context(), conn, session)
}

// initialSize reads ?rows=&cols=, falling back to 24x80 for missing or out-of-range values.
func initialSize(r *http.Request) agentclient.TerminalSize {
	return agentclient.TerminalSize{
		Rows: cells(r.URL.Query().Get("rows"), defaultRows),
		Cols: cells(r.URL.Query().Get("cols"), defaultCols),
	}
}

func cells(raw string, fallback uint32) uint32 {
	value, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || value == 0 || value > maxCells {
		return fallback
	}
	return uint32(value)
}
