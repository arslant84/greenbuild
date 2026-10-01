// Package mtls builds the agent's TLS configuration: only the control plane, holding a client
// certificate from the trusted CA, may connect (architecture.md: agent accepts mTLS only).
package mtls

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
)

// ErrNoCACertificates is wrapped when the CA file contains no usable certificate.
var ErrNoCACertificates = errors.New("no CA certificates found")

// Files are the PEM files the agent needs.
type Files struct {
	// CA signs the client certificates the agent accepts.
	CA   string
	Cert string
	Key  string
}

// ServerConfig requires every client to present a certificate signed by the CA and valid for
// client authentication, and allows TLS 1.3 only.
func ServerConfig(files Files) (*tls.Config, error) {
	certificate, err := tls.LoadX509KeyPair(files.Cert, files.Key)
	if err != nil {
		return nil, fmt.Errorf("load agent certificate %s: %w", files.Cert, err)
	}
	clientCAs, err := loadCAPool(files.CA)
	if err != nil {
		return nil, err
	}
	return &tls.Config{
		Certificates: []tls.Certificate{certificate},
		ClientCAs:    clientCAs,
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS13,
	}, nil
}

func loadCAPool(path string) (*x509.CertPool, error) {
	pemBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read CA %s: %w", path, err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pemBytes) {
		return nil, fmt.Errorf("%w in %s", ErrNoCACertificates, path)
	}
	return pool, nil
}
