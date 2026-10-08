package redactlog

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func logLine(t *testing.T, write func(*bytes.Buffer)) (map[string]any, string) {
	t.Helper()
	var out bytes.Buffer
	write(&out)
	var entry map[string]any
	if err := json.Unmarshal(out.Bytes(), &entry); err != nil {
		t.Fatalf("log line is not JSON: %v: %q", err, out.String())
	}
	return entry, out.String()
}

func TestRedactsCredentialHeadersAndSecretFields(t *testing.T) {
	entry, line := logLine(t, func(out *bytes.Buffer) {
		New(out, "sandbox-engine").Info("check request", "Authorization", "Bearer eyJ.secret", "cookie", "s=1", "attachToken", "t-1", "client_secret", "c", "attempt", "a1")
	})
	for _, key := range []string{"Authorization", "cookie", "attachToken", "client_secret"} {
		if entry[key] != Redacted {
			t.Errorf("%s = %v, want %s", key, entry[key], Redacted)
		}
	}
	if entry["attempt"] != "a1" || entry["service"] != "sandbox-engine" {
		t.Errorf("clean fields changed: %v", entry)
	}
	if strings.Contains(line, "eyJ.secret") {
		t.Errorf("the token reached the log: %s", line)
	}
}

func TestRedactsPasswordsInConnectionStrings(t *testing.T) {
	entry, line := logLine(t, func(out *bytes.Buffer) {
		New(out, "sandbox-engine").Warn("connect redis://:p4ss@cache:6379 failed", "error", errors.New("dial postgres://app:p4ss@db/app: refused"))
	})
	if entry["msg"] != "connect redis://:"+Redacted+"@cache:6379 failed" {
		t.Errorf("msg = %v", entry["msg"])
	}
	if strings.Contains(line, "p4ss") {
		t.Errorf("a password reached the log: %s", line)
	}
}

func TestLeavesCleanValuesAlone(t *testing.T) {
	entry, _ := logLine(t, func(out *bytes.Buffer) {
		New(out, "sandbox-agent").Info("sandbox-agent listening", "addr", ":8081", "url", "http://example.com/x")
	})
	if entry["addr"] != ":8081" || entry["url"] != "http://example.com/x" {
		t.Errorf("clean values changed: %v", entry)
	}
}
