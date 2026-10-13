//go:build integration

package sandbox

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// probeTimeout bounds one probe; every refusal below comes within seconds. It is a context deadline,
// not Command.Timeout: Run reads exit code 137 under a timeout as timed out, and an OOM kill (the
// memory probe's refusal) is 137 too.
const probeTimeout = 30 * time.Second

// escapeProbes are attacks from inside a sandbox, each a shell script that exits 0 only if the attack
// worked. docs/security/sandbox-escape-checklist.md describes each one and what refuses it.
// forkProbeExtra is how many processes past the cap the fork probe tries.
const forkProbeExtra = 44

var escapeProbes = []struct{ name, script string }{
	{"outbound network", "wget -T 3 -q -O /dev/null http://1.1.1.1"},
	{"mount a filesystem", "mount -t tmpfs none /mnt"},
	{"read kernel memory", `[ "$(head -c 16 /proc/kcore 2>/dev/null | wc -c)" -gt 0 ]`},
	{"reach the Docker socket", "test -S /var/run/docker.sock"},
	{"open a raw socket", "arping -c 1 -w 2 -I lo 127.0.0.1"},
	{"exceed the memory limit", "head -c 200m /dev/zero | tail > /dev/null"},
}

// architecture.md, task 34a: every probe is refused. Each runs in a fresh sandbox, so one probe's
// leftovers (such as 255 sleeping processes) cannot make the next one pass or fail. Runs under
// SANDBOX_TEST_RUNTIME (runsc in CI).
func TestSandboxRefusesEscapeProbesOnRealDocker(t *testing.T) {
	manager := NewManager(newDockerClient(t), runtimeUnderTest())
	for _, probe := range append(escapeProbes, forkProbe(PidsLimitFor(runtimeUnderTest()))) {
		t.Run(probe.name, func(t *testing.T) {
			spec := Spec{Image: integrationImage, Command: []string{"sleep", "300"}, CPUMillis: 500, MemoryBytes: 64 << 20, TTL: 5 * time.Minute}
			id, err := manager.CreateSandbox(t.Context(), spec)
			if err != nil {
				t.Fatalf("CreateSandbox() error = %v", err)
			}
			t.Cleanup(func() {
				if err := manager.Destroy(context.Background(), id); err != nil {
					t.Logf("cleanup destroy %s: %v", id, err)
				}
			})

			ctx, cancel := context.WithTimeout(t.Context(), probeTimeout)
			defer cancel()
			result, err := manager.Run(ctx, id, Command{Argv: []string{"sh", "-c", probe.script}})
			if err != nil || result.ExitCode == 0 {
				t.Errorf("%s = %+v, %v; want it refused (non-zero exit)", probe.name, result, err)
			}
		})
	}
}

// forkProbe tries to run more processes than the sandbox's cap. ash exits when it cannot fork, and under
// runsc going past the cap ends the sandbox, so either way the script ends non-zero.
func forkProbe(pidsLimit int64) struct{ name, script string } {
	script := fmt.Sprintf("for i in $(seq %d); do sleep 30 & done 2>/dev/null; set -- /proc/[0-9]*; [ $# -gt %d ]", pidsLimit+forkProbeExtra, pidsLimit)
	return struct{ name, script string }{"fork past the PID limit", script}
}
