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
	if cfg.IdleTimeout != 5*time.Minute {
		t.Errorf("IdleTimeout = %v, want 5m", cfg.IdleTimeout)
	}
}

func TestLoadOverrides(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{
		envHTTPAddr:        "0.0.0.0:9000",
		envShutdownTimeout: "3s",
		envIdleTimeout:     "90s",
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
	if cfg.IdleTimeout != 90*time.Second {
		t.Errorf("IdleTimeout = %v, want 90s", cfg.IdleTimeout)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	cases := map[string]map[string]string{
		"address without port": {envHTTPAddr: "localhost"},
		"unparsable timeout":   {envShutdownTimeout: "soon"},
		"zero timeout":         {envShutdownTimeout: "0s"},
		"negative timeout":     {envShutdownTimeout: "-1s"},
		"zero idle timeout":    {envIdleTimeout: "0s"},
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

	strong := strings.Repeat("k", minSecretBytes)
	if cfg, err := Load(envFrom(map[string]string{envAttachSecret: strong})); err != nil || cfg.AttachSecret != strong {
		t.Errorf("Load() with a %d-byte secret = %v", minSecretBytes, err)
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

func TestLoadInternalTokenAndChallengesDir(t *testing.T) {
	strong := strings.Repeat("i", minSecretBytes)
	cfg, err := Load(envFrom(map[string]string{envInternalToken: strong, envChallengesDir: "/srv/challenges"}))
	if err != nil || cfg.InternalToken != strong || cfg.ChallengesDir != "/srv/challenges" {
		t.Fatalf("Load() = %q, %q, %v", cfg.InternalToken, cfg.ChallengesDir, err)
	}

	weak := "short-internal-token"
	_, err = Load(envFrom(map[string]string{envInternalToken: weak}))
	if !errors.Is(err, ErrInvalid) || strings.Contains(err.Error(), weak) {
		t.Errorf("Load() with a short token error = %v, want ErrInvalid without the token in it", err)
	}
}

func TestLoadRedis(t *testing.T) {
	cfg, err := Load(envFrom(nil))
	if err != nil || cfg.Redis != nil {
		t.Fatalf("Load() = %v, %v; want the consumer off by default", cfg.Redis, err)
	}

	cfg, err = Load(envFrom(map[string]string{envRedisURL: "redis://:s3cret@redis.internal:6380/2"}))
	if err != nil || cfg.Redis.Addr != "redis.internal:6380" || cfg.Redis.Password != "s3cret" || cfg.Redis.DB != 2 {
		t.Fatalf("Load() = %+v, %v; want the parsed URL", cfg.Redis, err)
	}

	_, err = Load(envFrom(map[string]string{envRedisURL: "http://:s3cret@redis.internal:6380"}))
	if !errors.Is(err, ErrInvalid) || strings.Contains(err.Error(), "s3cret") {
		t.Errorf("Load() with a bad URL error = %v, want ErrInvalid without the password in it", err)
	}
}

func TestLoadSessionBlob(t *testing.T) {
	connection := "AccountName=greenbuild;AccountKey=a2V5;EndpointSuffix=core.windows.net"
	cfg, err := Load(envFrom(map[string]string{envSessionBlob: connection}))
	if err != nil || cfg.SessionBlobConnectionString != connection {
		t.Fatalf("Load() = %q, %v; want the connection string", cfg.SessionBlobConnectionString, err)
	}
}
