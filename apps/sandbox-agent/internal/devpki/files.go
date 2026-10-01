package devpki

import (
	"fmt"
	"os"
	"path/filepath"
)

// File names WriteFiles uses inside the target directory.
const (
	CAFile         = "ca.pem"
	ServerCertFile = "agent.pem"
	ServerKeyFile  = "agent-key.pem"
	ClientCertFile = "engine.pem"
	ClientKeyFile  = "engine-key.pem"
)

const (
	dirMode  = 0o700
	certMode = 0o644
	keyMode  = 0o600
)

// WriteFiles saves the CA certificate and both leaf pairs. The CA's private key is not written:
// nobody can mint more certificates from these files, and a fresh run makes a new CA.
func (b Bundle) WriteFiles(dir string) error {
	if err := os.MkdirAll(dir, dirMode); err != nil {
		return fmt.Errorf("create %s: %w", dir, err)
	}
	files := []struct {
		name string
		data []byte
		mode os.FileMode
	}{
		{CAFile, b.CA.CertPEM, certMode},
		{ServerCertFile, b.Server.CertPEM, certMode},
		{ServerKeyFile, b.Server.KeyPEM, keyMode},
		{ClientCertFile, b.Client.CertPEM, certMode},
		{ClientKeyFile, b.Client.KeyPEM, keyMode},
	}
	for _, file := range files {
		path := filepath.Join(dir, file.name)
		if err := os.WriteFile(path, file.data, file.mode); err != nil {
			return fmt.Errorf("write %s: %w", path, err)
		}
	}
	return nil
}
