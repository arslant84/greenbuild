package main

import (
	"errors"
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/sessionlog"
)

func TestSessionLogsStayOffWithoutAConnectionString(t *testing.T) {
	if err := recordSessions(config.Config{}, attach.NewHandler(nil, nil, nil)); err != nil {
		t.Errorf("recordSessions() error = %v, want nil", err)
	}
}

func TestSessionLogsRefuseABadConnectionString(t *testing.T) {
	cfg := config.Config{SessionBlobConnectionString: "not a connection string"}
	if err := recordSessions(cfg, attach.NewHandler(nil, nil, nil)); !errors.Is(err, sessionlog.ErrConnectionString) {
		t.Errorf("recordSessions() error = %v, want ErrConnectionString", err)
	}
}
