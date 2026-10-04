package main

import (
	"fmt"
	"log/slog"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/sessionlog"
)

// sessionRecordings saves /attach session logs when a Blob Storage connection string is set;
// otherwise it returns nil.
func sessionRecordings(cfg config.Config) (attach.StartRecording, error) {
	if cfg.SessionBlobConnectionString == "" {
		slog.Warn("session logs disabled; set SANDBOX_ENGINE_SESSION_BLOB_CONNECTION_STRING to save them")
		return nil, nil
	}
	store, err := sessionlog.NewBlobStore(cfg.SessionBlobConnectionString)
	if err != nil {
		return nil, fmt.Errorf("session logs: %w", err)
	}
	return recordTo(sessionlog.New(store)), nil
}

// recordTo adapts a session log, whose Start returns a concrete type, to attach.
func recordTo(log *sessionlog.Log) attach.StartRecording {
	return func(granted attachtoken.Attach) attach.Recording {
		return log.Start(granted.AttemptID, granted.SandboxID)
	}
}
