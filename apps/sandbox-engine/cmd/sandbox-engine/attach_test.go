package main

import (
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/packages/devpki"
)

var attachSecret = strings.Repeat("s", 32)

func agentTLS(t *testing.T) config.TLSFiles {
	t.Helper()
	bundle, err := devpki.Generate(devpki.Options{ServerHosts: []string{"localhost"}, ClientName: "sandbox-engine", ValidFor: time.Hour})
	if err != nil {
		t.Fatalf("generate certificates: %v", err)
	}
	dir := t.TempDir()
	if err := bundle.WriteFiles(dir); err != nil {
		t.Fatalf("write certificates: %v", err)
	}
	return config.TLSFiles{
		CA:   filepath.Join(dir, devpki.CAFile),
		Cert: filepath.Join(dir, devpki.ClientCertFile),
		Key:  filepath.Join(dir, devpki.ClientKeyFile),
	}
}

func routePattern(t *testing.T, server *http.Server, path string) string {
	t.Helper()
	request, err := http.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	_, pattern := server.Handler.(*http.ServeMux).Handler(request)
	return pattern
}

func TestAttachStaysOffWithoutASecret(t *testing.T) {
	handler, release, err := buildAttach(config.Config{})
	if err != nil || handler != nil {
		t.Fatalf("buildAttach() = %v, %v; want no handler and no error", handler, err)
	}
	release()
	if pattern := routePattern(t, newServer("127.0.0.1:0", nil), "/attach"); pattern != "" {
		t.Errorf("/attach is routed (%q) while disabled", pattern)
	}
}

func TestAttachNeedsTheAgentTLSFiles(t *testing.T) {
	if _, _, err := buildAttach(config.Config{AttachSecret: attachSecret}); !errors.Is(err, errAttachNeedsAgent) {
		t.Errorf("buildAttach() error = %v, want errAttachNeedsAgent", err)
	}
}

func TestAttachIsServedWhenConfigured(t *testing.T) {
	cfg := config.Config{AttachSecret: attachSecret, Agent: config.AgentConfig{
		Addr: "127.0.0.1:9443", ServerName: "localhost", TLS: agentTLS(t),
	}}

	handler, release, err := buildAttach(cfg)
	if err != nil || handler == nil {
		t.Fatalf("buildAttach() = %v, %v; want a handler", handler, err)
	}
	defer release()
	if pattern := routePattern(t, newServer("127.0.0.1:0", handler), "/attach"); pattern != "GET /attach" {
		t.Errorf("/attach route = %q, want GET /attach", pattern)
	}
}
