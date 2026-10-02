// Package config loads the sandbox engine settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"net"
	"time"
)

const (
	envHTTPAddr        = "SANDBOX_ENGINE_HTTP_ADDR"
	envShutdownTimeout = "SANDBOX_ENGINE_SHUTDOWN_TIMEOUT"
	envAgentAddr       = "SANDBOX_ENGINE_AGENT_ADDR"
	envAgentServerName = "SANDBOX_ENGINE_AGENT_SERVER_NAME"
	envTLSCA           = "SANDBOX_ENGINE_TLS_CA"
	envTLSCert         = "SANDBOX_ENGINE_TLS_CERT"
	envTLSKey          = "SANDBOX_ENGINE_TLS_KEY"
	envAttachSecret    = "SANDBOX_ENGINE_ATTACH_SECRET"

	// minAttachSecretBytes matches HS256's key size; shorter secrets are easier to brute-force.
	minAttachSecretBytes = 32

	// Loopback by default so a local run is not exposed; containers set 0.0.0.0 explicitly.
	defaultHTTPAddr        = "127.0.0.1:8080"
	defaultShutdownTimeout = 10 * time.Second
	// Matches the agent's default gRPC address and a name in its dev certificate.
	defaultAgentAddr       = "127.0.0.1:9443"
	defaultAgentServerName = "localhost"
)

// ErrInvalid is wrapped by every validation error returned from Load.
var ErrInvalid = errors.New("invalid config")

// Config holds the engine settings.
type Config struct {
	HTTPAddr        string
	ShutdownTimeout time.Duration
	Agent           AgentConfig
	// AttachSecret verifies browser attach tokens; empty keeps /attach off. Never log it.
	AttachSecret string
}

// AgentConfig is how the engine reaches a sandbox agent. Without TLS files the engine does not
// talk to agents at all: it never connects without mTLS.
type AgentConfig struct {
	Addr string
	// ServerName must match a name in the agent's certificate.
	ServerName string
	TLS        TLSFiles
}

// TLSFiles are the engine's client certificate, its key, and the CA that signed the agents.
type TLSFiles struct {
	CA   string
	Cert string
	Key  string
}

// Enabled reports whether all three files are configured.
func (f TLSFiles) Enabled() bool {
	return f.CA != ""
}

// Load reads the config through getenv so tests can supply their own values.
func Load(getenv func(string) string) (Config, error) {
	var cfg Config
	var err error
	if cfg.HTTPAddr, err = loadAddr(getenv, envHTTPAddr, defaultHTTPAddr); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownTimeout, err = loadShutdownTimeout(getenv); err != nil {
		return Config{}, err
	}
	if cfg.Agent.Addr, err = loadAddr(getenv, envAgentAddr, defaultAgentAddr); err != nil {
		return Config{}, err
	}
	cfg.Agent.ServerName = valueOr(getenv(envAgentServerName), defaultAgentServerName)
	if cfg.Agent.TLS, err = loadTLS(getenv); err != nil {
		return Config{}, err
	}
	if cfg.AttachSecret, err = loadAttachSecret(getenv); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func loadAddr(getenv func(string) string, key, fallback string) (string, error) {
	addr := getenv(key)
	if addr == "" {
		return fallback, nil
	}
	if _, _, err := net.SplitHostPort(addr); err != nil {
		return "", fmt.Errorf("%w: %s %q: %w", ErrInvalid, key, addr, err)
	}
	return addr, nil
}

func loadShutdownTimeout(getenv func(string) string) (time.Duration, error) {
	raw := getenv(envShutdownTimeout)
	if raw == "" {
		return defaultShutdownTimeout, nil
	}
	timeout, err := parsePositiveDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("%w: %s %q: %w", ErrInvalid, envShutdownTimeout, raw, err)
	}
	return timeout, nil
}

// loadTLS accepts all three paths or none; a partial set is a deployment mistake.
func loadTLS(getenv func(string) string) (TLSFiles, error) {
	files := TLSFiles{CA: getenv(envTLSCA), Cert: getenv(envTLSCert), Key: getenv(envTLSKey)}
	set := 0
	for _, path := range []string{files.CA, files.Cert, files.Key} {
		if path != "" {
			set++
		}
	}
	if set != 0 && set != 3 {
		return TLSFiles{}, fmt.Errorf("%w: set all of %s, %s, %s or none", ErrInvalid, envTLSCA, envTLSCert, envTLSKey)
	}
	return files, nil
}

// loadAttachSecret reports only the length of a bad secret, never its value.
func loadAttachSecret(getenv func(string) string) (string, error) {
	secret := getenv(envAttachSecret)
	if secret != "" && len(secret) < minAttachSecretBytes {
		return "", fmt.Errorf("%w: %s is %d bytes, need at least %d", ErrInvalid, envAttachSecret, len(secret), minAttachSecretBytes)
	}
	return secret, nil
}

func valueOr(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func parsePositiveDuration(raw string) (time.Duration, error) {
	duration, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("parse duration: %w", err)
	}
	if duration <= 0 {
		return 0, errors.New("must be positive")
	}
	return duration, nil
}
