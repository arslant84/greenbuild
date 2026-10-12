// Package config loads the sandbox agent settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"net"
	"regexp"
	"time"
)

const (
	envHealthAddr      = "SANDBOX_AGENT_HEALTH_ADDR"
	envGRPCAddr        = "SANDBOX_AGENT_GRPC_ADDR"
	envShutdownTimeout = "SANDBOX_AGENT_SHUTDOWN_TIMEOUT"
	envRuntime         = "SANDBOX_AGENT_RUNTIME"
	envTLSCA           = "SANDBOX_AGENT_TLS_CA"
	envTLSCert         = "SANDBOX_AGENT_TLS_CERT"
	envTLSKey          = "SANDBOX_AGENT_TLS_KEY"
	envStack           = "SANDBOX_AGENT_STACK"

	// RuntimeGVisor is the production runtime; RuntimeRunc is only for local development without gVisor.
	RuntimeGVisor = "runsc"
	RuntimeRunc   = "runc"

	// Loopback by default: the agent must not be reachable by anything but the control plane.
	defaultHealthAddr      = "127.0.0.1:8081"
	defaultGRPCAddr        = "127.0.0.1:9443"
	defaultShutdownTimeout = 10 * time.Second
)

// ErrInvalid is wrapped by every validation error returned from Load.
var ErrInvalid = errors.New("invalid config")

// Config holds the agent settings.
type Config struct {
	HealthAddr      string
	GRPCAddr        string
	ShutdownTimeout time.Duration
	Runtime         string
	TLS             TLSFiles
	// Stack names the local stack the agent belongs to, so its sandboxes can be told apart from another
	// stack's on the same Docker daemon (pnpm play:down removes its own). Empty on nodes.
	Stack string
}

var stackPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

// TLSFiles are the PEM paths for the gRPC server. All empty means the gRPC server stays off;
// it never runs without mTLS.
type TLSFiles struct {
	CA   string
	Cert string
	Key  string
}

// Enabled reports whether the gRPC server can start.
func (f TLSFiles) Enabled() bool {
	return f.CA != ""
}

// Load reads the config through getenv so tests can supply their own values.
func Load(getenv func(string) string) (Config, error) {
	var cfg Config
	var err error
	if cfg.HealthAddr, err = loadAddr(getenv, envHealthAddr, defaultHealthAddr); err != nil {
		return Config{}, err
	}
	if cfg.GRPCAddr, err = loadAddr(getenv, envGRPCAddr, defaultGRPCAddr); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownTimeout, err = loadShutdownTimeout(getenv); err != nil {
		return Config{}, err
	}
	if cfg.Runtime, err = loadRuntime(getenv); err != nil {
		return Config{}, err
	}
	if cfg.TLS, err = loadTLS(getenv); err != nil {
		return Config{}, err
	}
	cfg.Stack = getenv(envStack)
	if cfg.Stack != "" && !stackPattern.MatchString(cfg.Stack) {
		return Config{}, fmt.Errorf("%w: %s %q: want lowercase letters, digits and dashes, at most 63", ErrInvalid, envStack, cfg.Stack)
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

func loadRuntime(getenv func(string) string) (string, error) {
	runtime := getenv(envRuntime)
	if runtime == "" {
		return RuntimeGVisor, nil
	}
	if runtime != RuntimeGVisor && runtime != RuntimeRunc {
		return "", fmt.Errorf("%w: %s %q: want %s or %s", ErrInvalid, envRuntime, runtime, RuntimeGVisor, RuntimeRunc)
	}
	return runtime, nil
}

// loadTLS accepts all three paths or none; a partial set is a deployment mistake, not a reason to run without TLS.
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
