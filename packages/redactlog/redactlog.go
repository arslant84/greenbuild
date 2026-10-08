// Package redactlog sets up the Go services' structured logs: JSON lines with credentials masked
// before they are written, by the same rules as the TypeScript apps' logger (packages/shared/src/logging).
package redactlog

import (
	"io"
	"log/slog"
	"regexp"
	"strings"
)

// Redacted replaces every masked value.
const Redacted = "[REDACTED]"

// sensitiveKeys are whole attribute keys that carry credentials, lower-cased.
var sensitiveKeys = map[string]bool{"authorization": true, "cookie": true, "set-cookie": true, "password": true, "passwd": true, "secret": true}

// sensitiveKeyParts only ever name a secret, wherever they appear in a key.
var sensitiveKeyParts = []string{"token", "secret", "password", "api_key", "apikey", "private_key"}

// credentialsInURL matches scheme://user:password@ in connection strings such as redis://:pw@cache:6379.
var credentialsInURL = regexp.MustCompile(`(?i)([a-z][a-z0-9+.-]*://[^:/@\s]*:)[^@\s]*@`)

func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	if sensitiveKeys[lower] {
		return true
	}
	for _, part := range sensitiveKeyParts {
		if strings.Contains(lower, part) {
			return true
		}
	}
	return false
}

func redactText(text string) string {
	return credentialsInURL.ReplaceAllString(text, "${1}"+Redacted+"@")
}

// ReplaceAttr is a slog.HandlerOptions.ReplaceAttr: it masks attributes under sensitive keys and the
// passwords in connection strings inside strings and errors, including the message.
func ReplaceAttr(_ []string, attr slog.Attr) slog.Attr {
	if isSensitiveKey(attr.Key) {
		return slog.String(attr.Key, Redacted)
	}
	switch attr.Value.Kind() {
	case slog.KindString:
		return slog.String(attr.Key, redactText(attr.Value.String()))
	case slog.KindAny:
		if err, ok := attr.Value.Any().(error); ok {
			return slog.String(attr.Key, redactText(err.Error()))
		}
	}
	return attr
}

// New returns a logger that writes one redacted JSON line per entry to w, tagged with service.
func New(w io.Writer, service string) *slog.Logger {
	return slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{ReplaceAttr: ReplaceAttr})).With("service", service)
}
