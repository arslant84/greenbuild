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

	// Loopback by default so a local run is not exposed; containers set 0.0.0.0 explicitly.
	defaultHTTPAddr        = "127.0.0.1:8080"
	defaultShutdownTimeout = 10 * time.Second
)

// ErrInvalid is wrapped by every validation error returned from Load.
var ErrInvalid = errors.New("invalid config")

// Config holds the engine settings.
type Config struct {
	HTTPAddr        string
	ShutdownTimeout time.Duration
}

// Load reads the config through getenv so tests can supply their own values.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{HTTPAddr: defaultHTTPAddr, ShutdownTimeout: defaultShutdownTimeout}

	if addr := getenv(envHTTPAddr); addr != "" {
		if _, _, err := net.SplitHostPort(addr); err != nil {
			return Config{}, fmt.Errorf("%w: %s %q: %w", ErrInvalid, envHTTPAddr, addr, err)
		}
		cfg.HTTPAddr = addr
	}

	if raw := getenv(envShutdownTimeout); raw != "" {
		timeout, err := parsePositiveDuration(raw)
		if err != nil {
			return Config{}, fmt.Errorf("%w: %s %q: %w", ErrInvalid, envShutdownTimeout, raw, err)
		}
		cfg.ShutdownTimeout = timeout
	}

	return cfg, nil
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
