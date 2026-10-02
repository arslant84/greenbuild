package main

import (
	"fmt"
	"log/slog"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/sessionlog"
)

// recordSessions makes /attach save session logs when a Blob Storage connection string is set.
func recordSessions(cfg config.Config, handler *attach.Handler) error {
	if cfg.SessionBlobConnectionString == "" {
		slog.Warn("session logs disabled; set SANDBOX_ENGINE_SESSION_BLOB_CONNECTION_STRING to save them")
		return nil
	}
	store, err := sessionlog.NewBlobStore(cfg.SessionBlobConnectionString)
	if err != nil {
		return fmt.Errorf("session logs: %w", err)
	}
	handler.RecordSessions(recordTo(sessionlog.New(store)))
	return nil
}

// recordTo adapts a session log, whose Start returns a concrete type, to attach.
func recordTo(log *sessionlog.Log) attach.StartRecording {
	return func(granted attachtoken.Attach) attach.Recording {
		return log.Start(granted.AttemptID, granted.SandboxID)
	}
}
