//go:build integration

// Package azuritetest runs Azurite, the Azure Storage emulator, for integration tests.
package azuritetest

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
)

const (
	image = "mcr.microsoft.com/azure-storage/azurite"
	// Azurite's built-in account and key, published in its documentation; not a secret.
	account   = "devstoreaccount1"
	key       = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
	readyWait = 30 * time.Second
)

// Start runs Azurite's blob service on a free loopback port, creates containerName and returns
// a connection string.
func Start(t *testing.T, containerName string) string {
	t.Helper()
	out, err := exec.CommandContext(t.Context(), "docker", "run", "-d", "--rm", "-p", "127.0.0.1::10000",
		image, "azurite-blob", "--blobHost", "0.0.0.0", "--skipApiVersionCheck").Output()
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
	connection := "DefaultEndpointsProtocol=http;AccountName=" + account + ";AccountKey=" + key +
		";BlobEndpoint=http://" + addr + "/" + account + ";"
	createContainer(t, connection, containerName)
	return connection
}

func createContainer(t *testing.T, connection, containerName string) {
	t.Helper()
	client, err := container.NewClientFromConnectionString(connection, containerName, nil)
	if err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(readyWait)
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

// Blob names one blob on Azurite.
type Blob struct {
	Connection string
	Container  string
	Name       string
}

// Download returns the blob's content and content type.
func Download(ctx context.Context, target Blob) (string, string, error) {
	client, err := container.NewClientFromConnectionString(target.Connection, target.Container, nil)
	if err != nil {
		return "", "", fmt.Errorf("container client: %w", err)
	}
	download, err := client.NewBlobClient(target.Name).DownloadStream(ctx, nil)
	if err != nil {
		return "", "", fmt.Errorf("download %s: %w", target.Name, err)
	}
	defer func() { _ = download.Body.Close() }()
	content, err := io.ReadAll(download.Body)
	if err != nil {
		return "", "", fmt.Errorf("read %s: %w", target.Name, err)
	}
	return string(content), *download.ContentType, nil
}
