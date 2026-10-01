// Package devpki creates a throwaway certificate authority with one server and one client
// certificate, for mTLS between the control plane and the agent in development and tests.
// Production certificates come from Key Vault, never from here.
package devpki

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"time"
)

const serialNumberBits = 128

// Pair is a PEM-encoded certificate and its private key.
type Pair struct {
	CertPEM []byte
	KeyPEM  []byte
}

// Bundle is a CA plus a server and a client certificate it signed.
type Bundle struct {
	CA     Pair
	Server Pair
	Client Pair
}

// Options names the certificates and sets how long they are valid.
type Options struct {
	// ServerHosts are DNS names or IPs the server certificate is valid for.
	ServerHosts []string
	ClientName  string
	ValidFor    time.Duration
}

// ErrInvalidOptions is wrapped when Options cannot produce usable certificates.
var ErrInvalidOptions = errors.New("invalid dev certificate options")

// Generate creates a fresh CA and the two leaf certificates.
func Generate(opts Options) (Bundle, error) {
	if len(opts.ServerHosts) == 0 || opts.ClientName == "" || opts.ValidFor <= 0 {
		return Bundle{}, fmt.Errorf("%w: need a server host, a client name and a positive validity", ErrInvalidOptions)
	}
	notBefore := time.Now().Add(-time.Minute)
	notAfter := notBefore.Add(opts.ValidFor)

	caTemplate := &x509.Certificate{
		Subject:               pkix.Name{CommonName: "greenbuild dev CA"},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign,
	}
	ca, caCert, caKey, err := issue(caTemplate, nil, nil)
	if err != nil {
		return Bundle{}, fmt.Errorf("create CA: %w", err)
	}

	server, _, _, err := issue(leafTemplate(opts.ServerHosts[0], x509.ExtKeyUsageServerAuth, notAfter, opts.ServerHosts), caCert, caKey)
	if err != nil {
		return Bundle{}, fmt.Errorf("create server certificate: %w", err)
	}
	client, _, _, err := issue(leafTemplate(opts.ClientName, x509.ExtKeyUsageClientAuth, notAfter, nil), caCert, caKey)
	if err != nil {
		return Bundle{}, fmt.Errorf("create client certificate: %w", err)
	}
	return Bundle{CA: ca, Server: server, Client: client}, nil
}

// leafTemplate allows exactly one use, server or client authentication, so neither side can pose as the other.
func leafTemplate(name string, usage x509.ExtKeyUsage, notAfter time.Time, hosts []string) *x509.Certificate {
	template := &x509.Certificate{
		Subject:     pkix.Name{CommonName: name},
		NotBefore:   time.Now().Add(-time.Minute),
		NotAfter:    notAfter,
		KeyUsage:    x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{usage},
	}
	for _, host := range hosts {
		if ip := net.ParseIP(host); ip != nil {
			template.IPAddresses = append(template.IPAddresses, ip)
		} else {
			template.DNSNames = append(template.DNSNames, host)
		}
	}
	return template
}

// issue creates a key for template and signs it with the parent, or self-signs when parent is nil.
func issue(template, parent *x509.Certificate, parentKey *ecdsa.PrivateKey) (Pair, *x509.Certificate, *ecdsa.PrivateKey, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return Pair{}, nil, nil, fmt.Errorf("generate key: %w", err)
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), serialNumberBits))
	if err != nil {
		return Pair{}, nil, nil, fmt.Errorf("generate serial number: %w", err)
	}
	template.SerialNumber = serial
	if parent == nil {
		parent, parentKey = template, key
	}

	der, err := x509.CreateCertificate(rand.Reader, template, parent, &key.PublicKey, parentKey)
	if err != nil {
		return Pair{}, nil, nil, fmt.Errorf("sign certificate: %w", err)
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		return Pair{}, nil, nil, fmt.Errorf("parse certificate: %w", err)
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return Pair{}, nil, nil, fmt.Errorf("encode key: %w", err)
	}
	return Pair{
		CertPEM: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		KeyPEM:  pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}),
	}, cert, key, nil
}
