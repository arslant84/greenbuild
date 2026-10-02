package attach

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/coder/websocket"
)

// controlMessage is a text frame: "resize" from the browser, "exit" to it.
type controlMessage struct {
	Type string `json:"type"`
	Rows uint32 `json:"rows,omitempty"`
	Cols uint32 `json:"cols,omitempty"`
	Code *int32 `json:"code,omitempty"`
}

// bridge runs until the shell exits or the browser leaves. Input runs in its own goroutine and
// is the only caller of Write, Resize and CloseInput; this goroutine is the only caller of Recv.
func bridge(ctx context.Context, conn *websocket.Conn, session Session) {
	go forwardInput(ctx, conn, session)

	for {
		event, err := session.Recv()
		if err != nil {
			_ = conn.Close(websocket.StatusInternalError, "terminal stream ended")
			return
		}
		if event.Exited {
			sendExit(ctx, conn, event.ExitCode)
			return
		}
		if err := conn.Write(ctx, websocket.MessageBinary, event.Output); err != nil {
			return
		}
	}
}

// forwardInput passes keystrokes and resizes to the shell; when the browser leaves, the
// session's input is closed so the agent ends the shell.
func forwardInput(ctx context.Context, conn *websocket.Conn, session Session) {
	defer func() { _ = session.CloseInput() }()
	for {
		kind, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		if kind == websocket.MessageBinary {
			if _, err := session.Write(data); err != nil {
				return
			}
			continue
		}
		applyControl(session, data)
	}
}

func applyControl(session Session, data []byte) {
	var message controlMessage
	if err := json.Unmarshal(data, &message); err != nil || message.Type != "resize" {
		return
	}
	size := agentclient.TerminalSize{Rows: message.Rows, Cols: message.Cols}
	if size.Rows == 0 || size.Cols == 0 || size.Rows > maxCells || size.Cols > maxCells {
		return
	}
	if err := session.Resize(size); err != nil {
		slog.Warn("resize terminal", "error", err)
	}
}

func sendExit(ctx context.Context, conn *websocket.Conn, code int32) {
	payload, err := json.Marshal(controlMessage{Type: "exit", Code: &code})
	if err != nil {
		return
	}
	if err := conn.Write(ctx, websocket.MessageText, payload); err != nil {
		return
	}
	_ = conn.Close(websocket.StatusNormalClosure, "shell exited")
}
