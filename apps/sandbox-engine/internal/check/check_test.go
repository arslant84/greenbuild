package check

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
)

const checkerScript = "#!/bin/sh\nwget -q -O - http://127.0.0.1/\n"

type fakeSandboxes struct {
	calls   []string
	result  agentclient.RunResult
	copyErr error
	runErr  error
}

func (f *fakeSandboxes) CopyIn(_ context.Context, sandboxID string, file agentclient.File) error {
	f.calls = append(f.calls, fmt.Sprintf("copy %s %s %o %d-bytes", sandboxID, file.Path, file.Mode, len(file.Content)))
	return f.copyErr
}

func (f *fakeSandboxes) Run(_ context.Context, sandboxID string, command agentclient.Command) (agentclient.RunResult, error) {
	f.calls = append(f.calls, fmt.Sprintf("run %s %v %s", sandboxID, command.Argv, command.Timeout))
	if command.Argv[0] == CheckerPath {
		return f.result, f.runErr
	}
	return agentclient.RunResult{}, nil
}

func challengesDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "nginx-502-upstream"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "nginx-502-upstream", "check.sh"), []byte(checkerScript), 0o644); err != nil {
		t.Fatalf("write checker: %v", err)
	}
	return dir
}

var wantCalls = []string{
	fmt.Sprintf("copy sbx-1 %s 700 %d-bytes", CheckerPath, len(checkerScript)),
	fmt.Sprintf("run sbx-1 [%s] 20s", CheckerPath),
	fmt.Sprintf("run sbx-1 [rm -f %s] 5s", CheckerPath),
}

func TestCheckCopiesRunsAndRemovesTheChecker(t *testing.T) {
	cases := map[string]struct {
		result agentclient.RunResult
		passed bool
	}{
		"passes on exit 0":  {agentclient.RunResult{ExitCode: 0, OutputTail: "the site is back\n"}, true},
		"fails on exit 1":   {agentclient.RunResult{ExitCode: 1, OutputTail: "the site does not answer with 200\n"}, false},
		"fails on timeout":  {agentclient.RunResult{ExitCode: 137, TimedOut: true}, false},
		"exit 0 but killed": {agentclient.RunResult{ExitCode: 0, TimedOut: true}, false},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			sandboxes := &fakeSandboxes{result: tc.result}
			result, err := NewChecker(sandboxes, challengesDir(t)).Run(t.Context(), "sbx-1", "nginx-502-upstream")
			if err != nil {
				t.Fatalf("Run() error = %v", err)
			}
			if result.Passed != tc.passed || result.OutputTail != tc.result.OutputTail {
				t.Errorf("Run() = %+v, want passed=%v", result, tc.passed)
			}
			if !slices.Equal(sandboxes.calls, wantCalls) {
				t.Errorf("calls = %q, want %q", sandboxes.calls, wantCalls)
			}
		})
	}
}

func TestCheckRemovesTheCheckerEvenWhenRunningFails(t *testing.T) {
	sandboxes := &fakeSandboxes{runErr: errors.New("agent unreachable")}

	if _, err := NewChecker(sandboxes, challengesDir(t)).Run(t.Context(), "sbx-1", "nginx-502-upstream"); err == nil {
		t.Fatal("Run() error = nil, want the run failure")
	}
	if !slices.Equal(sandboxes.calls, wantCalls) {
		t.Errorf("calls = %q, want the checker removed after the failure", sandboxes.calls)
	}
}

func TestCheckRejectsUnknownOrUnsafeChallengeIDs(t *testing.T) {
	for _, id := range []string{"", "../etc", "a/b", "Nginx", "-x", "missing-challenge", "nginx-502-upstream/../x"} {
		t.Run(id, func(t *testing.T) {
			sandboxes := &fakeSandboxes{}
			_, err := NewChecker(sandboxes, challengesDir(t)).Run(t.Context(), "sbx-1", id)
			if !errors.Is(err, ErrUnknownChallenge) {
				t.Errorf("Run(%q) error = %v, want ErrUnknownChallenge", id, err)
			}
			if len(sandboxes.calls) != 0 {
				t.Errorf("calls = %q, want none", sandboxes.calls)
			}
		})
	}
}
