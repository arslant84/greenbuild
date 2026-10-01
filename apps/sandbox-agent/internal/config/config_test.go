package config

import (
	"errors"
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
	if cfg.HealthAddr != defaultHealthAddr {
		t.Errorf("HealthAddr = %q, want %q", cfg.HealthAddr, defaultHealthAddr)
	}
	if cfg.ShutdownTimeout != defaultShutdownTimeout {
		t.Errorf("ShutdownTimeout = %v, want %v", cfg.ShutdownTimeout, defaultShutdownTimeout)
	}
	if cfg.Runtime != RuntimeGVisor {
		t.Errorf("Runtime = %q, want %q (gVisor by default)", cfg.Runtime, RuntimeGVisor)
	}
}

func TestLoadAcceptsRuncForLocalDevelopment(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{envRuntime: "runc"}))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Runtime != RuntimeRunc {
		t.Errorf("Runtime = %q, want %q", cfg.Runtime, RuntimeRunc)
	}
}

func TestLoadOverrides(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{
		envHealthAddr:      "0.0.0.0:9000",
		envShutdownTimeout: "3s",
	}))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.HealthAddr != "0.0.0.0:9000" {
		t.Errorf("HealthAddr = %q, want 0.0.0.0:9000", cfg.HealthAddr)
	}
	if cfg.ShutdownTimeout != 3*time.Second {
		t.Errorf("ShutdownTimeout = %v, want 3s", cfg.ShutdownTimeout)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	cases := map[string]map[string]string{
		"address without port": {envHealthAddr: "localhost"},
		"unparsable timeout":   {envShutdownTimeout: "soon"},
		"zero timeout":         {envShutdownTimeout: "0s"},
		"negative timeout":     {envShutdownTimeout: "-1s"},
		"unknown runtime":      {envRuntime: "kata"},
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
