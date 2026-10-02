package config

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func envFrom(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.HTTPAddr != defaultHTTPAddr {
		t.Errorf("HTTPAddr = %q, want %q", cfg.HTTPAddr, defaultHTTPAddr)
	}
	if cfg.ShutdownTimeout != defaultShutdownTimeout {
		t.Errorf("ShutdownTimeout = %v, want %v", cfg.ShutdownTimeout, defaultShutdownTimeout)
	}
}

func TestLoadOverrides(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{
		envHTTPAddr:        "0.0.0.0:9000",
		envShutdownTimeout: "3s",
	}))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.HTTPAddr != "0.0.0.0:9000" {
		t.Errorf("HTTPAddr = %q, want 0.0.0.0:9000", cfg.HTTPAddr)
	}
	if cfg.ShutdownTimeout != 3*time.Second {
		t.Errorf("ShutdownTimeout = %v, want 3s", cfg.ShutdownTimeout)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	cases := map[string]map[string]string{
		"address without port": {envHTTPAddr: "localhost"},
		"unparsable timeout":   {envShutdownTimeout: "soon"},
		"zero timeout":         {envShutdownTimeout: "0s"},
		"negative timeout":     {envShutdownTimeout: "-1s"},
	}
	for name, env := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := Load(envFrom(env))
			if !errors.Is(err, ErrInvalid) {
				t.Errorf("Load() error = %v, want ErrInvalid", err)
			}
		})
	}
}

func TestLoadAgentDefaults(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Agent.Addr != defaultAgentAddr || cfg.Agent.ServerName != defaultAgentServerName {
		t.Errorf("Agent = %+v, want %s and %s", cfg.Agent, defaultAgentAddr, defaultAgentServerName)
	}
	if cfg.Agent.TLS.Enabled() {
		t.Error("agent TLS enabled without certificate paths")
	}
}

func TestLoadAgentOverridesAndTLS(t *testing.T) {
	all := map[string]string{
		envAgentAddr: "10.1.0.5:9443", envAgentServerName: "sandbox-agent",
		envTLSCA: "ca.pem", envTLSCert: "engine.pem", envTLSKey: "engine-key.pem",
	}
	cfg, err := Load(envFrom(all))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Agent.Addr != "10.1.0.5:9443" || cfg.Agent.ServerName != "sandbox-agent" || !cfg.Agent.TLS.Enabled() {
		t.Errorf("Agent = %+v, want the overrides with TLS enabled", cfg.Agent)
	}

	delete(all, envTLSKey)
	if _, err := Load(envFrom(all)); !errors.Is(err, ErrInvalid) {
		t.Errorf("Load() with a partial TLS set error = %v, want ErrInvalid", err)
	}
	if _, err := Load(envFrom(map[string]string{envAgentAddr: "no-port"})); !errors.Is(err, ErrInvalid) {
		t.Errorf("Load() with a bad agent address error = %v, want ErrInvalid", err)
	}
}

func TestLoadAttachSecret(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil || cfg.AttachSecret != "" {
		t.Fatalf("Load() = %q, %v; want no secret by default", cfg.AttachSecret, err)
	}

	strong := strings.Repeat("k", minAttachSecretBytes)
	if cfg, err := Load(envFrom(map[string]string{envAttachSecret: strong})); err != nil || cfg.AttachSecret != strong {
		t.Errorf("Load() with a %d-byte secret = %v", minAttachSecretBytes, err)
	}

	weak := "hunter2-but-short"
	_, err = Load(envFrom(map[string]string{envAttachSecret: weak}))
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("Load() with a short secret error = %v, want ErrInvalid", err)
	}
	if strings.Contains(err.Error(), weak) {
		t.Error("the error message leaks the secret")
	}
}

func TestLoadAllowedOrigins(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{envAllowedOrigins: " greenbuild.dev, ,app.greenbuild.dev "}))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if want := []string{"greenbuild.dev", "app.greenbuild.dev"}; strings.Join(cfg.AllowedOrigins, ",") != strings.Join(want, ",") {
		t.Errorf("AllowedOrigins = %q, want %q", cfg.AllowedOrigins, want)
	}
}
