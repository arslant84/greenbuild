package main

import (
	"path/filepath"
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/agentserver"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/config"
)

func TestStartGRPCStaysOffWithoutTLS(t *testing.T) {
	stop, err := startGRPC(config.Config{GRPCAddr: "127.0.0.1:0"}, agentserver.Sandboxes(nil))
	if err != nil {
		t.Fatalf("startGRPC() error = %v, want nil (disabled, not failed)", err)
	}
	stop()
}

func TestStartGRPCFailsOnUnreadableCertificates(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "missing.pem")
	cfg := config.Config{
		GRPCAddr: "127.0.0.1:0",
		TLS:      config.TLSFiles{CA: missing, Cert: missing, Key: missing},
	}
	if _, err := startGRPC(cfg, agentserver.Sandboxes(nil)); err == nil {
		t.Fatal("startGRPC() error = nil, want an error instead of serving without valid mTLS")
	}
}
