//go:build integration

package agentclient_test

// architecture.md, task 9: after the player fixes nginx-502, the check returns passed.
// Uses the real challenge (image, setup, checker, reference solution) and the real agent process.

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/check"
	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
)

const (
	challengeID    = "nginx-502-upstream"
	challengeImage = "greenbuild-challenge/" + challengeID + ":e2e"
	challengesDir  = "../../../../challenges"
	solutionPath   = "/tmp/solution.sh"
)

func TestCheckPassesOnlyAfterTheFixOnRealDocker(t *testing.T) {
	buildChallengeImage(t)
	opts := agentclient.EngineOptions(t, "localhost", agentclient.NewBundle(t, "localhost"))
	agentclient.StartRealAgent(t, opts)
	client := agentclient.Dialed(t, opts)
	sandboxID := createBrokenSandbox(t, client)
	checker := check.NewChecker(client, challengesDir)

	before := runCheck(t, checker, sandboxID)
	if before.Passed || !strings.Contains(before.OutputTail, "does not answer with 200") {
		t.Fatalf("check before the fix = %+v, want failed with the 502 message", before)
	}

	applyReferenceSolution(t, client, sandboxID)

	after := runCheck(t, checker, sandboxID)
	if !after.Passed || !strings.Contains(after.OutputTail, "the site is back") {
		t.Fatalf("check after the fix = %+v, want passed", after)
	}
	left, err := client.Run(t.Context(), sandboxID, agentclient.Command{Argv: []string{"test", "-e", check.CheckerPath}})
	if err != nil || left.ExitCode == 0 {
		t.Errorf("checker still in the sandbox after the check (err %v, exit %d)", err, left.ExitCode)
	}
}

func buildChallengeImage(t *testing.T) {
	t.Helper()
	build := exec.CommandContext(t.Context(), "docker", "build", "-q", "-t", challengeImage, filepath.Join(challengesDir, challengeID))
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build %s: %v\n%s", challengeImage, err, out)
	}
}

// createBrokenSandbox starts the challenge with a seed; the agent runs setup.sh, so nginx returns 502.
func createBrokenSandbox(t *testing.T, client *agentclient.Client) string {
	t.Helper()
	seed := uint64(4242)
	id, err := client.CreateSandbox(t.Context(), &agentv1.CreateSandboxRequest{
		Image: challengeImage, Command: []string{"sleep", "infinity"}, CpuMillis: 500, MemoryBytes: 512 << 20,
		Capabilities: []string{"CHOWN", "SETUID", "SETGID"}, TtlSeconds: 300, SetupSeed: &seed,
	})
	if err != nil {
		t.Fatalf("CreateSandbox() error = %v", err)
	}
	t.Cleanup(func() { _ = client.Destroy(context.Background(), id) })
	return id
}

func runCheck(t *testing.T, checker *check.Checker, sandboxID string) check.Result {
	t.Helper()
	result, err := checker.Run(t.Context(), sandboxID, challengeID)
	if err != nil {
		t.Fatalf("check error = %v", err)
	}
	return result
}

// applyReferenceSolution does what a player would type: point nginx at the app's real port.
func applyReferenceSolution(t *testing.T, client *agentclient.Client, sandboxID string) {
	t.Helper()
	solution, err := os.ReadFile(filepath.Join(challengesDir, challengeID, "solution.sh"))
	if err != nil {
		t.Fatalf("read solution: %v", err)
	}
	if err := client.CopyIn(t.Context(), sandboxID, agentclient.File{Path: solutionPath, Content: solution, Mode: 0o700}); err != nil {
		t.Fatalf("copy solution: %v", err)
	}
	fixed, err := client.Run(t.Context(), sandboxID, agentclient.Command{Argv: []string{"sh", solutionPath}, Timeout: 30 * time.Second})
	if err != nil || fixed.ExitCode != 0 {
		t.Fatalf("solution = %+v, %v", fixed, err)
	}
}
