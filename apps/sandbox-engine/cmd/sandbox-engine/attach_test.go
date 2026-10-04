package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
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

// configured returns a config with agent TLS and a live (not yet connected) agent client.
func configured(t *testing.T) (config.Config, *agentclient.Client) {
	t.Helper()
	cfg := config.Config{Agent: config.AgentConfig{Addr: "127.0.0.1:9443", ServerName: "localhost", TLS: agentTLS(t)}}
	client, release, err := dialAgent(cfg)
	if err != nil {
		t.Fatalf("dialAgent() error = %v", err)
	}
	t.Cleanup(release)
	return cfg, client
}

func TestOptionalRoutesStayOffWithoutTheirSecrets(t *testing.T) {
	cfg, client := configured(t)
	attachHandler, attachErr := buildAttach(cfg, client, nil)
	internalHandler, internalErr := buildInternal(cfg, client, nil)
	if attachHandler != nil || internalHandler != nil || attachErr != nil || internalErr != nil {
		t.Fatalf("got %v %v %v %v; want both off without errors", attachHandler, internalHandler, attachErr, internalErr)
	}
	server := newServer("127.0.0.1:0", routes{})
	if routePattern(t, server, "/attach") != "" || routePattern(t, server, "/internal/attempts/a/check") != "" {
		t.Error("a disabled route is still routed")
	}
}

func TestOptionalRoutesRefuseIncompleteConfig(t *testing.T) {
	if _, err := buildAttach(config.Config{AttachSecret: attachSecret}, nil, nil); !errors.Is(err, errNeedsAgent) {
		t.Errorf("attach without agent: %v, want errNeedsAgent", err)
	}
	if _, err := buildInternal(config.Config{InternalToken: attachSecret}, nil, nil); !errors.Is(err, errNeedsAgent) {
		t.Errorf("internal without agent: %v, want errNeedsAgent", err)
	}
	cfg, client := configured(t)
	cfg.InternalToken = attachSecret
	if _, err := buildInternal(cfg, client, nil); !errors.Is(err, errNeedsChallengesDir) {
		t.Errorf("internal without challenges dir: %v, want errNeedsChallengesDir", err)
	}
}

func TestOptionalRoutesAreServedWhenConfigured(t *testing.T) {
	cfg, client := configured(t)
	cfg.AttachSecret, cfg.InternalToken, cfg.ChallengesDir = attachSecret, attachSecret, t.TempDir()
	attachHandler, err := buildAttach(cfg, client, nil)
	if err != nil {
		t.Fatalf("buildAttach() error = %v", err)
	}
	internalHandler, err := buildInternal(cfg, client, nil)
	if err != nil {
		t.Fatalf("buildInternal() error = %v", err)
	}
	server := newServer("127.0.0.1:0", routes{attach: attachHandler, internal: internalHandler})

	if pattern := routePattern(t, server, "/attach"); pattern != "GET /attach" {
		t.Errorf("/attach route = %q", pattern)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/internal/attempts/att-1/check", nil)
	recorder := httptest.NewRecorder()
	server.Handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("check without the internal token: status %d, want 401", recorder.Code)
	}
}
