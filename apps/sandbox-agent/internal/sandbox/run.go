package sandbox

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"
)

// killedExitCode is what busybox timeout returns after SIGKILL (128 + 9).
const killedExitCode = 137

// ErrInvalidCommand is wrapped when Run gets no command to run.
var ErrInvalidCommand = errors.New("invalid command")

// Command is a program to run in a sandbox without a terminal.
type Command struct {
	Argv []string
	// Timeout kills the command inside the sandbox; zero means no limit. Docker cannot stop an
	// exec from outside, so the limit has to be enforced in the container.
	Timeout time.Duration
}

// RunResult is a finished command.
type RunResult struct {
	ExitCode   int
	OutputTail string
	// TimedOut means the command was killed by its timeout. Inferred from exit code 137 with a
	// timeout set, so a command that dies from SIGKILL for another reason also counts.
	TimedOut bool
}

// Run executes command in the sandbox and waits for it.
func (m *Manager) Run(ctx context.Context, id string, command Command) (RunResult, error) {
	if len(command.Argv) == 0 {
		return RunResult{}, fmt.Errorf("%w: argv is empty", ErrInvalidCommand)
	}
	argv := command.Argv
	if command.Timeout > 0 {
		seconds := strconv.FormatFloat(math.Ceil(command.Timeout.Seconds()), 'f', 0, 64)
		argv = append([]string{"timeout", "-s", "KILL", seconds}, argv...)
	}

	result, err := m.exec(ctx, id, argv)
	if err != nil {
		return RunResult{}, fmt.Errorf("run %v in sandbox %s: %w", command.Argv, id, err)
	}
	return RunResult{
		ExitCode:   result.exitCode,
		OutputTail: result.output,
		TimedOut:   command.Timeout > 0 && result.exitCode == killedExitCode,
	}, nil
}
