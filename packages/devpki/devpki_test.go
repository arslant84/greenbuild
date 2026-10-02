package devpki

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func testBundle(t *testing.T) Bundle {
	t.Helper()
	bundle, err := Generate(Options{ServerHosts: []string{"localhost", "127.0.0.1"}, ClientName: "sandbox-engine", ValidFor: time.Hour})
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	return bundle
}

func parseCert(t *testing.T, pemBytes []byte) *x509.Certificate {
	t.Helper()
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		t.Fatal("no PEM block")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatalf("parse certificate: %v", err)
	}
	return cert
}

func verify(t *testing.T, bundle Bundle, leaf []byte, opts x509.VerifyOptions) error {
	t.Helper()
	opts.Roots = x509.NewCertPool()
	opts.Roots.AddCert(parseCert(t, bundle.CA.CertPEM))
	if _, err := parseCert(t, leaf).Verify(opts); err != nil {
		return fmt.Errorf("verify leaf: %w", err)
	}
	return nil
}

func TestServerCertificateIsTrustedForItsHostsOnly(t *testing.T) {
	bundle := testBundle(t)
	serverAuth := []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}

	for _, host := range []string{"localhost", "127.0.0.1"} {
		if err := verify(t, bundle, bundle.Server.CertPEM, x509.VerifyOptions{DNSName: host, KeyUsages: serverAuth}); err != nil {
			t.Errorf("server certificate for %s: %v", host, err)
		}
	}
	if err := verify(t, bundle, bundle.Server.CertPEM, x509.VerifyOptions{DNSName: "evil.example", KeyUsages: serverAuth}); err == nil {
		t.Error("server certificate verified for a host it was not issued for")
	}
}

func TestLeafCertificatesCannotSwapRoles(t *testing.T) {
	bundle := testBundle(t)
	clientAuth := x509.VerifyOptions{KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}
	serverAuth := x509.VerifyOptions{DNSName: "localhost", KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}

	if err := verify(t, bundle, bundle.Client.CertPEM, clientAuth); err != nil {
		t.Errorf("client certificate rejected for client auth: %v", err)
	}
	if err := verify(t, bundle, bundle.Server.CertPEM, clientAuth); err == nil {
		t.Error("server certificate accepted as a client certificate")
	}
	if err := verify(t, bundle, bundle.Client.CertPEM, serverAuth); err == nil {
		t.Error("client certificate accepted as a server certificate")
	}
}

func TestEachRunCreatesAnUnrelatedCA(t *testing.T) {
	first, second := testBundle(t), testBundle(t)
	clientAuth := x509.VerifyOptions{KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth}}

	if err := verify(t, first, second.Client.CertPEM, clientAuth); err == nil {
		t.Error("a certificate from another run was trusted")
	}
}

func TestGenerateRejectsIncompleteOptions(t *testing.T) {
	cases := map[string]Options{
		"no server host": {ClientName: "c", ValidFor: time.Hour},
		"no client name": {ServerHosts: []string{"localhost"}, ValidFor: time.Hour},
		"no validity":    {ServerHosts: []string{"localhost"}, ClientName: "c"},
	}
	for name, opts := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Generate(opts); !errors.Is(err, ErrInvalidOptions) {
				t.Errorf("Generate() error = %v, want ErrInvalidOptions", err)
			}
		})
	}
}

func TestWriteFilesKeepsKeysPrivateAndOmitsTheCAKey(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "certs")
	if err := testBundle(t).WriteFiles(dir); err != nil {
		t.Fatalf("WriteFiles() error = %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read dir: %v", err)
	}
	if len(entries) != 5 {
		t.Errorf("wrote %d files, want 5 (CA cert, two certs, two keys; no CA key)", len(entries))
	}
	if runtime.GOOS == "windows" {
		return // Windows does not have Unix permission bits.
	}
	info, err := os.Stat(filepath.Join(dir, ServerKeyFile))
	if err != nil {
		t.Fatalf("stat key: %v", err)
	}
	if info.Mode().Perm() != keyMode {
		t.Errorf("key mode = %v, want %v", info.Mode().Perm(), os.FileMode(keyMode))
	}
}
