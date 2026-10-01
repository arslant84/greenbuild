package sandbox

import (
	"errors"
	"slices"
	"testing"
)

func checkerFile() File {
	return File{Path: "/opt/greenbuild/check.sh", Content: []byte("#!/bin/sh\nexit 0\n"), Mode: 0o755}
}

func TestCopyInStreamsContentAndPassesPathAsArgument(t *testing.T) {
	docker := &fakeDocker{}

	if err := NewManager(docker, "runsc").CopyIn(t.Context(), fakeContainerID, checkerFile()); err != nil {
		t.Fatalf("CopyIn() error = %v", err)
	}

	want := []string{"sh", "-c", writeFileScript, "sh", "/opt/greenbuild/check.sh", "755"}
	if !slices.Equal(docker.lastExec.Cmd, want) {
		t.Errorf("Cmd = %q, want %q", docker.lastExec.Cmd, want)
	}
	if !docker.lastExec.AttachStdin {
		t.Error("stdin not attached; the content would never arrive")
	}
	execID := "exec-1"
	if got := string(docker.stdinOf(execID)); got != "#!/bin/sh\nexit 0\n" {
		t.Errorf("stdin = %q, want the file content", got)
	}
}

func TestCopyInRejectsUnsafeFilesWithoutCallingDocker(t *testing.T) {
	cases := map[string]File{
		"relative path":  {Path: "opt/check.sh", Mode: 0o644},
		"dot-dot":        {Path: "/opt/greenbuild/../../etc/passwd", Mode: 0o644},
		"trailing slash": {Path: "/opt/greenbuild/", Mode: 0o644},
		"nul byte":       {Path: "/opt/check\x00.sh", Mode: 0o644},
		"setuid bit":     {Path: "/opt/check.sh", Mode: 0o4755},
	}
	for name, file := range cases {
		t.Run(name, func(t *testing.T) {
			docker := &fakeDocker{}
			err := NewManager(docker, "runsc").CopyIn(t.Context(), fakeContainerID, file)
			if !errors.Is(err, ErrInvalidFile) {
				t.Errorf("CopyIn() error = %v, want ErrInvalidFile", err)
			}
			if len(docker.calls) != 0 {
				t.Errorf("calls = %v, want none", docker.calls)
			}
		})
	}
}

func TestCopyInReportsAFailedWrite(t *testing.T) {
	docker := &fakeDocker{execs: map[string]fakeExec{"sh": {exitCode: 1, output: "cat: can't create: Read-only file system"}}}

	err := NewManager(docker, "runsc").CopyIn(t.Context(), fakeContainerID, checkerFile())
	if err == nil {
		t.Fatal("CopyIn() error = nil, want the failed write reported")
	}
}
