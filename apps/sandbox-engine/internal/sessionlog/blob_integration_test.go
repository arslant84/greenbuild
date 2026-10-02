//go:build integration

package sessionlog

import (
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
