package mtls

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-agent/internal/devpki"
)

const handshakeTimeout = 5 * time.Second

func writeBundle(t *testing.T) (string, devpki.Bundle) {
	t.Helper()
	bundle, err := devpki.Generate(devpki.Options{ServerHosts: []string{"localhost"}, ClientName: "sandbox-engine", ValidFor: time.Hour})
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	dir := t.TempDir()
	if err := bundle.WriteFiles(dir); err != nil {
		t.Fatalf("write: %v", err)
	}
	return dir, bundle
}

func serverFiles(dir string) Files {
	return Files{
		CA:   filepath.Join(dir, devpki.CAFile),
		Cert: filepath.Join(dir, devpki.ServerCertFile),
		Key:  filepath.Join(dir, devpki.ServerKeyFile),
	}
}

// serverHandshake runs one TLS handshake against ServerConfig and returns the server's verdict;
// with TLS 1.3 the client can finish before the server rejects its certificate.
func serverHandshake(t *testing.T, dir string, client *tls.Config) error {
	t.Helper()
	config, err := ServerConfig(serverFiles(dir))
	if err != nil {
		t.Fatalf("ServerConfig() error = %v", err)
	}
	listener, err := tls.Listen("tcp", "127.0.0.1:0", config)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	// Closing a test listener or connection after the verdict cannot affect the result.
	defer func() { _ = listener.Close() }()

	verdict := make(chan error, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			verdict <- err
			return
		}
		defer func() { _ = conn.Close() }()
		_ = conn.SetDeadline(time.Now().Add(handshakeTimeout))
		verdict <- conn.(*tls.Conn).Handshake()
	}()

	if conn, err := tls.Dial("tcp", listener.Addr().String(), client); err == nil {
		_ = conn.SetDeadline(time.Now().Add(handshakeTimeout))
		_, _ = conn.Read(make([]byte, 1)) // lets the server's rejection arrive
		_ = conn.Close()
	}
	return <-verdict
}

func clientConfig(t *testing.T, bundle devpki.Bundle, cert devpki.Pair) *tls.Config {
	t.Helper()
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(bundle.CA.CertPEM)
	config := &tls.Config{RootCAs: roots, ServerName: "localhost", MinVersion: tls.VersionTLS12}
	if cert.CertPEM != nil {
		pair, err := tls.X509KeyPair(cert.CertPEM, cert.KeyPEM)
		if err != nil {
			t.Fatalf("client key pair: %v", err)
		}
		config.Certificates = []tls.Certificate{pair}
	}
	return config
}

func TestAcceptsClientWithCertificateFromTheCA(t *testing.T) {
	dir, bundle := writeBundle(t)
	if err := serverHandshake(t, dir, clientConfig(t, bundle, bundle.Client)); err != nil {
		t.Errorf("handshake error = %v, want success", err)
	}
}

func TestRejectsUntrustedClients(t *testing.T) {
	dir, bundle := writeBundle(t)
	_, otherCA := writeBundle(t)
	tls12Only := clientConfig(t, bundle, bundle.Client)
	tls12Only.MaxVersion = tls.VersionTLS12

	cases := map[string]*tls.Config{
		"no client certificate":            clientConfig(t, bundle, devpki.Pair{}),
		"certificate from another CA":      clientConfig(t, bundle, otherCA.Client),
		"agent's own server certificate":   clientConfig(t, bundle, bundle.Server),
		"TLS 1.2 with a valid certificate": tls12Only,
	}
	for name, client := range cases {
		t.Run(name, func(t *testing.T) {
			if err := serverHandshake(t, dir, client); err == nil {
				t.Error("handshake succeeded, want the agent to refuse it")
			}
		})
	}
}

func TestServerConfigFailsOnMissingOrEmptyFiles(t *testing.T) {
	dir, _ := writeBundle(t)
	empty := filepath.Join(dir, "empty.pem")
	if err := os.WriteFile(empty, nil, 0o600); err != nil {
		t.Fatalf("write empty file: %v", err)
	}

	missingKey := serverFiles(dir)
	missingKey.Key = filepath.Join(dir, "missing.pem")
	if _, err := ServerConfig(missingKey); err == nil {
		t.Error("ServerConfig() with a missing key = nil error")
	}
	emptyCA := serverFiles(dir)
	emptyCA.CA = empty
	if _, err := ServerConfig(emptyCA); !errors.Is(err, ErrNoCACertificates) {
		t.Errorf("ServerConfig() with an empty CA error = %v, want ErrNoCACertificates", err)
	}
}
