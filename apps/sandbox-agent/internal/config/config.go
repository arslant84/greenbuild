// Package config loads the sandbox agent settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"net"
	"time"
)

const (
	envHealthAddr      = "SANDBOX_AGENT_HEALTH_ADDR"
	envShutdownTimeout = "SANDBOX_AGENT_SHUTDOWN_TIMEOUT"

	// Loopback by default: the agent must not be reachable by anything but the control plane.
	defaultHealthAddr      = "127.0.0.1:8081"
	defaultShutdownTimeout = 10 * time.Second
)

// ErrInvalid is wrapped by every validation error returned from Load.
var ErrInvalid = errors.New("invalid config")

// Config holds the agent settings.
type Config struct {
	HealthAddr      string
	ShutdownTimeout time.Duration
}

// Load reads the config through getenv so tests can supply their own values.
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{HealthAddr: defaultHealthAddr, ShutdownTimeout: defaultShutdownTimeout}

	if addr := getenv(envHealthAddr); addr != "" {
		if _, _, err := net.SplitHostPort(addr); err != nil {
			return Config{}, fmt.Errorf("%w: %s %q: %w", ErrInvalid, envHealthAddr, addr, err)
		}
		cfg.HealthAddr = addr
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
