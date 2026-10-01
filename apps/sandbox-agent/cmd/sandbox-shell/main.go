// Command sandbox-shell opens an interactive shell in a fresh sandbox, to check the agent by hand.
// The sandbox gets the agent's isolation and is destroyed when the shell exits.
//
//	go run ./cmd/sandbox-shell
//	go run ./cmd/sandbox-shell -image greenbuild-challenge/nginx-502-upstream:verify -seed 4242 -cap CHOWN,SETUID,SETGID
//
// The image must already exist locally (docker pull or docker build).
package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/console"
	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/sandbox"
	"github.com/moby/moby/client"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "sandbox-shell:", err)
		os.Exit(1)
	}
}

func run() error {
	opts, err := parseOptions(os.Args[1:])
	if err != nil {
		return err
	}
	docker, err := client.New(client.FromEnv)
	if err != nil {
		return fmt.Errorf("create docker client: %w", err)
	}
	defer closeDocker(docker)

	ctx := context.Background()
	manager := sandbox.NewManager(docker, opts.runtime)
	id, err := manager.CreateSandbox(ctx, opts.spec)
	if err != nil {
		return fmt.Errorf("create sandbox: %w", err)
	}
	defer destroySandbox(manager, id)

	if opts.runSetup {
		if err := manager.RunSetup(ctx, id, opts.seed); err != nil {
			return fmt.Errorf("run setup: %w", err)
		}
	}
	return attach(ctx, manager, id)
}

// attach connects this terminal to a shell in the sandbox until the shell exits.
func attach(ctx context.Context, manager *sandbox.Manager, id string) error {
	terminal, err := manager.OpenTerminal(ctx, id, currentSize())
	if err != nil {
		return fmt.Errorf("open terminal: %w", err)
	}
	defer terminal.Close()

	restore, err := console.MakeRaw(os.Stdin, os.Stdout)
	if err != nil {
		slog.Warn("terminal stays in line mode; keys like Ctrl+C go to this tool", "error", err)
	} else {
		defer restore()
	}

	watchCtx, stopWatching := context.WithCancel(ctx)
	defer stopWatching()
	go console.WatchResize(watchCtx, terminal, currentSize, resizePollInterval)
	go copyInput(terminal.Input(), os.Stdin)

	if _, err := io.Copy(os.Stdout, terminal.Output()); err != nil {
		return fmt.Errorf("read terminal output: %w", err)
	}
	code, err := terminal.ExitCode(ctx)
	if err != nil {
		return fmt.Errorf("read exit code: %w", err)
	}
	fmt.Fprintf(os.Stderr, "\r\nshell exited with code %d; sandbox destroyed\r\n", code)
	return nil
}

func copyInput(dst io.Writer, src io.Reader) {
	if _, err := io.Copy(dst, src); err != nil {
		slog.Debug("input stream closed", "error", err)
	}
}

func currentSize() sandbox.TerminalSize {
	if size, ok := console.Size(os.Stdout); ok {
		return size
	}
	return sandbox.TerminalSize{Rows: fallbackRows, Cols: fallbackCols}
}

func destroySandbox(manager *sandbox.Manager, id string) {
	if err := manager.Destroy(context.Background(), id); err != nil {
		fmt.Fprintf(os.Stderr, "destroy sandbox %s: %v (the agent's reaper removes it after its TTL)\n", id, err)
	}
}

func closeDocker(docker *client.Client) {
	if err := docker.Close(); err != nil {
		slog.Warn("close docker client", "error", err)
	}
}
