package main

import (
	"flag"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
)

const (
	defaultImage       = "alpine:3"
	defaultTTL         = 30 * time.Minute
	defaultCPUMillis   = 1000
	defaultMemoryBytes = 512 << 20
	fallbackRows       = 24
	fallbackCols       = 80
	resizePollInterval = 250 * time.Millisecond
)

type options struct {
	spec     sandbox.Spec
	runtime  string
	seed     uint64
	runSetup bool
}

func parseOptions(args []string) (options, error) {
	flags := flag.NewFlagSet("sandbox-shell", flag.ContinueOnError)
	image := flags.String("image", defaultImage, "image to run; must exist locally")
	runtime := flags.String("runtime", config.RuntimeRunc, "OCI runtime: runc (local Docker) or runsc (gVisor)")
	seed := flags.String("seed", "", "run "+sandbox.SetupScriptPath+" with this seed before opening the shell")
	capabilities := flags.String("cap", "", "comma-separated capabilities to add back, e.g. CHOWN,SETUID,SETGID")
	ttl := flags.Duration("ttl", defaultTTL, "destroy the sandbox after this long even if the shell is still open")
	if err := flags.Parse(args); err != nil {
		return options{}, fmt.Errorf("parse flags: %w", err)
	}

	opts := options{runtime: *runtime, spec: sandbox.Spec{
		Image:        *image,
		Command:      []string{"sleep", "infinity"},
		CPUMillis:    defaultCPUMillis,
		MemoryBytes:  defaultMemoryBytes,
		Capabilities: splitList(*capabilities),
		TTL:          *ttl,
	}}
	if *seed != "" {
		parsed, err := strconv.ParseUint(*seed, 10, 64)
		if err != nil {
			return options{}, fmt.Errorf("seed %q: must be a non-negative integer", *seed)
		}
		opts.seed, opts.runSetup = parsed, true
	}
	if err := opts.spec.Validate(); err != nil {
		return options{}, fmt.Errorf("sandbox options: %w", err)
	}
	return opts, nil
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
