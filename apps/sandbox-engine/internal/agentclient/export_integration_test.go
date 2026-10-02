//go:build integration

package agentclient

import (
	"testing"

	"github.com/arslant84/greenbuild/packages/devpki"
)

// Test-only exports for agentclient_test, which cannot live in this package: it imports
// internal/attach, and attach imports agentclient.

func EnsureImage(t *testing.T) { ensureImage(t) }

func NewBundle(t *testing.T, hosts ...string) devpki.Bundle { return newBundle(t, hosts...) }

func EngineOptions(t *testing.T, serverName string, bundle devpki.Bundle) Options {
	return engineOptions(t, freeAddr(t), serverName, bundle)
}

func StartRealAgent(t *testing.T, opts Options) { startRealAgent(t, opts) }

func Dialed(t *testing.T, opts Options) *Client { return dialed(t, opts) }
