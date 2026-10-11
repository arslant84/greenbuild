//go:build integration

package sessionlog

import (
	"strings"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/azuritetest"
)

func TestBlobStoreAppendsSessionsOnRealDocker(t *testing.T) {
	connection := azuritetest.Start(t, Container)
	store, err := NewBlobStore(connection)
	if err != nil {
		t.Fatal(err)
	}
	name := Name("att-blob", time.Now())
	for _, session := range []string{"{\"type\":\"start\"}\n", "{\"type\":\"end\"}\n"} {
		if err := store.Append(t.Context(), name, []byte(session)); err != nil {
			t.Fatalf("Append() error = %v", err)
		}
	}
	content, mime, err := azuritetest.Download(t.Context(), azuritetest.Blob{Connection: connection, Container: Container, Name: name})
	if err != nil {
		t.Fatal(err)
	}
	if content != "{\"type\":\"start\"}\n{\"type\":\"end\"}\n" || mime != contentType {
		t.Errorf("saved %q as %s, want both sessions in order as %s", content, mime, contentType)
	}
}

// Task 49a: a session is in Blob Storage before it ends. The recording is never finished, as when the
// engine is killed, and the blob still holds the command typed before the last flush.
func TestSessionSurvivesAnEngineThatDiesOnRealDocker(t *testing.T) {
	connection := azuritetest.Start(t, Container)
	store, err := NewBlobStore(connection)
	if err != nil {
		t.Fatal(err)
	}
	recording := (&Log{store: store, now: time.Now, flushEvery: 50 * time.Millisecond}).Start("att-crash", "sbx-crash")
	recording.Input([]byte("systemctl status nginx\r"))

	blob := azuritetest.Blob{Connection: connection, Container: Container, Name: Name("att-crash", time.Now())}
	deadline := time.Now().Add(10 * time.Second)
	for {
		content, _, err := azuritetest.Download(t.Context(), blob)
		if err == nil && strings.Contains(content, `"data":"systemctl status nginx"`) {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("blob = %q, %v; want the command saved before the session ended", content, err)
		}
		time.Sleep(50 * time.Millisecond)
	}
}
