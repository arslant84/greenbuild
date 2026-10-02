package sandbox

import (
	"errors"
	"slices"
	"testing"
	"time"
)

func TestRunWrapsTheCommandInATimeout(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{"timeout": {exitCode: 0, output: "ok\n"}}}

	result, err := NewManager(docker, "runsc").Run(t.Context(), fakeContainerID, Command{
		Argv: []string{"/opt/greenbuild/check.sh"}, Timeout: 1500 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if want := []string{"timeout", "-s", "KILL", "2", "/opt/greenbuild/check.sh"}; !slices.Equal(docker.lastExec.Cmd, want) {
		t.Errorf("Cmd = %v, want %v (timeout rounded up)", docker.lastExec.Cmd, want)
	}
	if result != (RunResult{ExitCode: 0, OutputTail: "ok\n"}) {
		t.Errorf("Run() = %+v", result)
	}
}

func TestRunWithoutTimeoutRunsTheCommandAsIs(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{"cat": {exitCode: 1, output: "no such file\n"}}}

	result, err := NewManager(docker, "runsc").Run(t.Context(), fakeContainerID, Command{Argv: []string{"cat", "/missing"}})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if !slices.Equal(docker.lastExec.Cmd, []string{"cat", "/missing"}) || result.ExitCode != 1 || result.TimedOut {
		t.Errorf("Cmd %v, result %+v", docker.lastExec.Cmd, result)
	}
}

func TestRunReportsATimeout(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{"timeout": {exitCode: killedExitCode}}}

	result, err := NewManager(docker, "runsc").Run(t.Context(), fakeContainerID, Command{Argv: []string{"sleep", "60"}, Timeout: time.Second})
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}
	if !result.TimedOut {
		t.Errorf("Run() = %+v, want TimedOut", result)
	}
}

func TestRunRejectsAnEmptyCommand(t *testing.T) {
	if _, err := NewManager(&fakeDocker{}, "runsc").Run(t.Context(), fakeContainerID, Command{}); !errors.Is(err, ErrInvalidCommand) {
		t.Errorf("Run() error = %v, want ErrInvalidCommand", err)
	}
}
