// Package check runs a challenge's checker in a sandbox (architecture.md: copy the checker in,
// run it, delete it, return {passed, output_tail, duration_ms}). The checker only exists in the
// sandbox for the length of a check.
package check

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
)

const (
	// CheckerPath is where the checker lives inside the sandbox during a check.
	CheckerPath = "/opt/greenbuild/check.sh"
	// checkerMode lets only root (the checker's run_as) read and run it.
	checkerMode = 0o700
	// checkTimeout is the manifest's check.timeout_sec for the first challenges.
	checkTimeout   = 20 * time.Second
	cleanupTimeout = 5 * time.Second
	maxIDLength    = 63
)

// ErrUnknownChallenge is returned when no checker exists for a challenge id.
var ErrUnknownChallenge = errors.New("unknown challenge")

// Sandboxes is what a check needs from the agent client.
type Sandboxes interface {
	CopyIn(ctx context.Context, sandboxID string, file agentclient.File) error
	Run(ctx context.Context, sandboxID string, command agentclient.Command) (agentclient.RunResult, error)
}

// Result is what the API stores for a check.
type Result struct {
	Passed     bool   `json:"passed"`
	OutputTail string `json:"output_tail"`
	DurationMS int64  `json:"duration_ms"`
}

// Checker runs checkers kept in a directory with one folder per challenge.
type Checker struct {
	sandboxes     Sandboxes
	challengesDir string
}

// NewChecker returns a Checker reading <challengesDir>/<challenge>/check.sh.
func NewChecker(sandboxes Sandboxes, challengesDir string) *Checker {
	return &Checker{sandboxes: sandboxes, challengesDir: challengesDir}
}

// Run copies the challenge's checker into the sandbox, runs it and always deletes it again.
// Passed means exit code 0 within the timeout.
func (c *Checker) Run(ctx context.Context, sandboxID, challengeID string) (Result, error) {
	checker, err := c.load(challengeID)
	if err != nil {
		return Result{}, err
	}
	started := time.Now()
	if err := c.sandboxes.CopyIn(ctx, sandboxID, agentclient.File{Path: CheckerPath, Content: checker, Mode: checkerMode}); err != nil {
		return Result{}, fmt.Errorf("copy checker: %w", err)
	}
	defer c.remove(ctx, sandboxID)

	ran, err := c.sandboxes.Run(ctx, sandboxID, agentclient.Command{Argv: []string{CheckerPath}, Timeout: checkTimeout})
	if err != nil {
		return Result{}, fmt.Errorf("run checker: %w", err)
	}
	return Result{
		Passed:     ran.ExitCode == 0 && !ran.TimedOut,
		OutputTail: ran.OutputTail,
		DurationMS: time.Since(started).Milliseconds(),
	}, nil
}

// load reads the checker; the id is validated first so it cannot point outside the directory.
func (c *Checker) load(challengeID string) ([]byte, error) {
	if !validID(challengeID) {
		return nil, fmt.Errorf("%w: invalid id %q", ErrUnknownChallenge, challengeID)
	}
	checker, err := os.ReadFile(filepath.Join(c.challengesDir, challengeID, "check.sh"))
	if errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("%w: %s", ErrUnknownChallenge, challengeID)
	}
	if err != nil {
		return nil, fmt.Errorf("read checker for %s: %w", challengeID, err)
	}
	return checker, nil
}

// remove deletes the checker even when the check failed or the request was cancelled.
func (c *Checker) remove(ctx context.Context, sandboxID string) {
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()
	removal := agentclient.Command{Argv: []string{"rm", "-f", CheckerPath}, Timeout: cleanupTimeout}
	if _, err := c.sandboxes.Run(cleanupCtx, sandboxID, removal); err != nil {
		slog.Error("remove checker; it stays visible until the sandbox ends", "sandbox", sandboxID, "error", err)
	}
}

// validID allows lowercase letters, digits and dashes, like the challenge folder names.
func validID(id string) bool {
	if id == "" || len(id) > maxIDLength || id[0] == '-' {
		return false
	}
	for _, r := range id {
		if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
			return false
		}
	}
	return true
}
