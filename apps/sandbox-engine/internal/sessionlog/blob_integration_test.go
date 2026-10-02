//go:build integration

package sessionlog

import (
	"io"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
)

const (
	azuriteImage = "mcr.microsoft.com/azure-storage/azurite"
	// Azurite's built-in account and key, published in its documentation; not a secret.
	azuriteAccount = "devstoreaccount1"
	azuriteKey     = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
	azuriteWait    = 30 * time.Second
)

// StartAzurite runs Azurite's blob service on a free loopback port, creates the sessions
// container and returns a connection string for it.
func StartAzurite(t *testing.T) string {
	t.Helper()
	out, err := exec.CommandContext(t.Context(), "docker", "run", "-d", "--rm", "-p", "127.0.0.1::10000",
		azuriteImage, "azurite-blob", "--blobHost", "0.0.0.0", "--skipApiVersionCheck").Output()
	if err != nil {
		t.Fatalf("start azurite: %v", err)
	}
	id := strings.TrimSpace(string(out))
	t.Cleanup(func() { _ = exec.Command("docker", "rm", "-f", id).Run() })
	port, err := exec.CommandContext(t.Context(), "docker", "port", id, "10000/tcp").Output()
	if err != nil {
		t.Fatalf("azurite port: %v", err)
	}
	addr, _, _ := strings.Cut(strings.TrimSpace(string(port)), "\n")
	connection := "DefaultEndpointsProtocol=http;AccountName=" + azuriteAccount + ";AccountKey=" + azuriteKey +
		";BlobEndpoint=http://" + addr + "/" + azuriteAccount + ";"
	createContainer(t, connection)
	return connection
}

func createContainer(t *testing.T, connection string) {
	t.Helper()
	client, err := container.NewClientFromConnectionString(connection, Container, nil)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(azuriteWait)
	for {
		_, err := client.Create(t.Context(), nil)
		if err == nil {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("create container on azurite: %v", err)
		}
		time.Sleep(300 * time.Millisecond)
	}
}

// ReadLog returns a saved session log and its content type.
func ReadLog(t *testing.T, connection, name string) (string, string) {
	t.Helper()
	client, err := container.NewClientFromConnectionString(connection, Container, nil)
	if err != nil {
		t.Fatal(err)
	}
	download, err := client.NewBlobClient(name).DownloadStream(t.Context(), nil)
	if err != nil {
		t.Fatalf("download %s: %v", name, err)
	}
	defer func() { _ = download.Body.Close() }()
	content, err := io.ReadAll(download.Body)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(content), *download.ContentType
}

func TestBlobStoreAppendsSessionsOnRealDocker(t *testing.T) {
	connection := StartAzurite(t)
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
	content, mime := ReadLog(t, connection, name)
	if content != "{\"type\":\"start\"}\n{\"type\":\"end\"}\n" || mime != contentType {
		t.Errorf("saved %q as %s, want both sessions in order as %s", content, mime, contentType)
	}
}
