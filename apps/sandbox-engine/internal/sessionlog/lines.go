package sessionlog

import (
	"strings"
	"unicode/utf8"
)

// maxLineBytes bounds a line that never ends, such as a long paste without a newline.
const maxLineBytes = 4096

const (
	keyBackspace   = 0x7f
	keyCtrlH       = 0x08
	keyCtrlC       = 0x03
	keyCtrlU       = 0x15
	keyEscape      = 0x1b
	firstPrintable = 0x20
	// Bytes that end an escape sequence such as ESC [ A (arrow up).
	escapeFinalFirst = 0x40
	escapeFinalLast  = 0x7e
)

type escapeState int

const (
	escapeNone escapeState = iota
	escapeStarted
	escapeInSequence
)

// lineBuffer rebuilds the lines a player typed from raw keystrokes. It is best effort: tab
// completion and shell history happen in the shell, which is why the raw input is logged too.
type lineBuffer struct {
	line   []byte
	escape escapeState
}

// feed returns every non-empty line that data completes.
func (b *lineBuffer) feed(data []byte) []string {
	var commands []string
	for _, key := range data {
		if command, done := b.key(key); done {
			commands = append(commands, command)
		}
	}
	return commands
}

func (b *lineBuffer) key(key byte) (string, bool) {
	if b.escape != escapeNone {
		b.skipEscape(key)
		return "", false
	}
	switch key {
	case '\r', '\n':
		command := strings.TrimSpace(string(b.line))
		b.line = b.line[:0]
		return command, command != ""
	case keyBackspace, keyCtrlH:
		_, size := utf8.DecodeLastRune(b.line)
		b.line = b.line[:len(b.line)-size]
	case keyCtrlC, keyCtrlU:
		b.line = b.line[:0]
	case keyEscape:
		b.escape = escapeStarted
	default:
		if key >= firstPrintable && len(b.line) < maxLineBytes {
			b.line = append(b.line, key)
		}
	}
	return "", false
}

// skipEscape drops arrow keys, Alt combinations and bracketed-paste markers; the pasted text
// between the markers still counts as typed.
func (b *lineBuffer) skipEscape(key byte) {
	if b.escape == escapeStarted {
		b.escape = escapeNone
		if key == '[' || key == 'O' {
			b.escape = escapeInSequence
		}
		return
	}
	if key >= escapeFinalFirst && key <= escapeFinalLast {
		b.escape = escapeNone
	}
}
