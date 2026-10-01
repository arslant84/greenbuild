package main

import (
	"errors"
	"slices"
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
)

func TestParseOptionsDefaults(t *testing.T) {
	opts, err := parseOptions(nil)
	if err != nil {
		t.Fatalf("parseOptions() error = %v", err)
	}
	if opts.spec.Image != defaultImage || opts.runtime != "runc" || opts.runSetup {
		t.Errorf("got image %q, runtime %q, runSetup %v; want %q, runc, false", opts.spec.Image, opts.runtime, opts.runSetup, defaultImage)
	}
	if !slices.Equal(opts.spec.Command, []string{"sleep", "infinity"}) {
		t.Errorf("Command = %v, want a long-running process so the shell has a container to join", opts.spec.Command)
	}
}

func TestParseOptionsChallengeImage(t *testing.T) {
	opts, err := parseOptions([]string{"-image", "challenge:verify", "-seed", "4242", "-cap", "CHOWN, SETUID,,SETGID", "-runtime", "runsc"})
	if err != nil {
		t.Fatalf("parseOptions() error = %v", err)
	}
	if !opts.runSetup || opts.seed != 4242 {
		t.Errorf("runSetup %v, seed %d; want true, 4242", opts.runSetup, opts.seed)
	}
	if !slices.Equal(opts.spec.Capabilities, []string{"CHOWN", "SETUID", "SETGID"}) {
		t.Errorf("Capabilities = %v, want [CHOWN SETUID SETGID]", opts.spec.Capabilities)
	}
	if opts.runtime != "runsc" {
		t.Errorf("runtime = %q, want runsc", opts.runtime)
	}
}

func TestParseOptionsRejectsBadInput(t *testing.T) {
	cases := map[string][]string{
		"negative seed":        {"-seed", "-1"},
		"text seed":            {"-seed", "abc"},
		"unknown flag":         {"-privileged"},
		"forbidden capability": {"-cap", "SYS_ADMIN"},
		"zero ttl":             {"-ttl", "0s"},
	}
	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := parseOptions(args); err == nil {
				t.Errorf("parseOptions(%v) error = nil, want an error", args)
			}
		})
	}
	_, err := parseOptions([]string{"-cap", "SYS_ADMIN"})
	if !errors.Is(err, sandbox.ErrInvalidSpec) {
		t.Errorf("forbidden capability error = %v, want ErrInvalidSpec from the agent's own allowlist", err)
	}
}
