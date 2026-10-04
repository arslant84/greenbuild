package main

import (
	"errors"
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/sessionlog"
)

func TestSessionLogsStayOffWithoutAConnectionString(t *testing.T) {
	if start, err := sessionRecordings(config.Config{}); start != nil || err != nil {
		t.Errorf("sessionRecordings() = %v, %v; want nil, nil", start, err)
	}
}

func TestSessionLogsRefuseABadConnectionString(t *testing.T) {
	cfg := config.Config{SessionBlobConnectionString: "not a connection string"}
	if _, err := sessionRecordings(cfg); !errors.Is(err, sessionlog.ErrConnectionString) {
		t.Errorf("sessionRecordings() error = %v, want ErrConnectionString", err)
	}
}
