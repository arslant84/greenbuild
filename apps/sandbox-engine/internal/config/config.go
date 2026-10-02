// Package config loads the sandbox engine settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
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
	envAllowedOrigins  = "SANDBOX_ENGINE_ALLOWED_ORIGINS"
	envInternalToken   = "SANDBOX_ENGINE_INTERNAL_TOKEN"
	envChallengesDir   = "SANDBOX_ENGINE_CHALLENGES_DIR"
	envRedisURL        = "SANDBOX_ENGINE_REDIS_URL"
	envSessionBlob     = "SANDBOX_ENGINE_SESSION_BLOB_CONNECTION_STRING"

	// minSecretBytes applies to the attach secret and the internal token; shorter ones are easier
	// to brute-force (and 32 bytes is the HS256 key size).
	minSecretBytes = 32

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
	// AllowedOrigins are browser origins besides the engine's own host that may open /attach,
	// e.g. "greenbuild.dev"; comma-separated in the environment.
	AllowedOrigins []string
	// InternalToken guards /internal routes; empty keeps them off. Never log it.
	InternalToken string
	// ChallengesDir holds one folder per challenge with its check.sh; the checker never ships
	// in the sandbox image.
	ChallengesDir string
	// Redis is where sandbox.create is read and sandbox.status written; nil keeps the consumer off.
	// It may hold a password, so never log it.
	Redis *redis.Options
	// SessionBlobConnectionString reaches the Blob Storage account for session logs; empty keeps
	// recording off. It holds the account key, so never log it.
	SessionBlobConnectionString string
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
	if cfg.AttachSecret, err = loadSecret(getenv, envAttachSecret); err != nil {
		return Config{}, err
	}
	if cfg.InternalToken, err = loadSecret(getenv, envInternalToken); err != nil {
		return Config{}, err
	}
	cfg.AllowedOrigins = splitList(getenv(envAllowedOrigins))
	cfg.ChallengesDir = getenv(envChallengesDir)
	cfg.SessionBlobConnectionString = getenv(envSessionBlob)
	if cfg.Redis, err = loadRedis(getenv); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// loadRedis does not wrap the parse error: it can quote the URL, and the URL can hold a password.
func loadRedis(getenv func(string) string) (*redis.Options, error) {
	raw := getenv(envRedisURL)
	if raw == "" {
		return nil, nil
	}
	options, err := redis.ParseURL(raw)
	if err != nil {
		return nil, fmt.Errorf("%w: %s is not a redis:// or rediss:// URL", ErrInvalid, envRedisURL)
	}
	return options, nil
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

// loadSecret reports only the length of a bad secret, never its value.
func loadSecret(getenv func(string) string, key string) (string, error) {
	secret := getenv(key)
	if secret != "" && len(secret) < minSecretBytes {
		return "", fmt.Errorf("%w: %s is %d bytes, need at least %d", ErrInvalid, key, len(secret), minSecretBytes)
	}
	return secret, nil
}

func splitList(value string) []string {
	var items []string
	for _, item := range strings.Split(value, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
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
