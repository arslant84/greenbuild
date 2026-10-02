package sandbox

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strconv"
	"strings"
)

// maxFileMode allows permission bits only: no setuid, setgid or sticky bits on copied files.
const maxFileMode os.FileMode = 0o777

// writeFileScript creates the parent directory, writes stdin to the file and sets its mode.
// The path and mode arrive as positional arguments, never inside the script text, so a crafted
// path cannot inject commands.
const writeFileScript = `mkdir -p "$(dirname "$1")" && cat > "$1" && chmod "$2" "$1"`

// ErrInvalidFile is wrapped when a file to copy has an unsafe path or mode.
var ErrInvalidFile = errors.New("invalid file for sandbox")

// File is a file to place inside a sandbox, such as the checker right before a check.
type File struct {
	// Path is absolute and already clean, e.g. /opt/greenbuild/check.sh.
	Path    string
	Content []byte
	Mode    os.FileMode
}

// Validate rejects relative or unclean paths and modes beyond permission bits.
func (f File) Validate() error {
	if !strings.HasPrefix(f.Path, "/") || path.Clean(f.Path) != f.Path || strings.ContainsRune(f.Path, 0) {
		return fmt.Errorf("%w: path %q must be absolute and clean", ErrInvalidFile, f.Path)
	}
	if f.Mode&^maxFileMode != 0 {
		return fmt.Errorf("%w: mode %o has bits beyond %o", ErrInvalidFile, f.Mode, maxFileMode)
	}
	return nil
}

// CopyIn writes file into the sandbox through exec, so it also works under gVisor, where
// files copied from the host side may not be visible inside the sandbox.
func (m *Manager) CopyIn(ctx context.Context, id string, file File) error {
	if err := file.Validate(); err != nil {
		return err
	}
	mode := strconv.FormatUint(uint64(file.Mode), 8)
	cmd := []string{"sh", "-c", writeFileScript, "sh", file.Path, mode}

	result, err := m.execWithInput(ctx, id, cmd, bytes.NewReader(file.Content))
	if err != nil {
		return fmt.Errorf("copy %s into sandbox %s: %w", file.Path, id, err)
	}
	if result.exitCode != 0 {
		return fmt.Errorf("copy %s into sandbox %s: exited %d: %s", file.Path, id, result.exitCode, result.output)
	}
	return nil
}
