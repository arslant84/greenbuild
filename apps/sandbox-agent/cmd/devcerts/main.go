// Command devcerts writes a throwaway CA and mTLS certificates for the agent (server) and
// the control plane (client), for local development only:
//
//	go run ./cmd/devcerts            # writes .certs/ (ignored by git)
//
// Every run creates a new CA, so certificates from different runs do not trust each other.
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/arslant84/greenbuild/packages/devpki"
)

const (
	defaultOutDir   = ".certs"
	defaultHosts    = "localhost,127.0.0.1,sandbox-agent"
	defaultValidFor = 365 * 24 * time.Hour
	clientName      = "sandbox-engine"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "devcerts:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	flags := flag.NewFlagSet("devcerts", flag.ContinueOnError)
	outDir := flags.String("out", defaultOutDir, "directory for the PEM files")
	hosts := flags.String("hosts", defaultHosts, "comma-separated names and IPs for the agent certificate")
	validFor := flags.Duration("valid", defaultValidFor, "how long the certificates are valid")
	if err := flags.Parse(args); err != nil {
		return fmt.Errorf("parse flags: %w", err)
	}

	bundle, err := devpki.Generate(devpki.Options{
		ServerHosts: strings.Split(*hosts, ","),
		ClientName:  clientName,
		ValidFor:    *validFor,
	})
	if err != nil {
		return fmt.Errorf("generate certificates: %w", err)
	}
	if err := bundle.WriteFiles(*outDir); err != nil {
		return fmt.Errorf("save certificates: %w", err)
	}

	fmt.Printf("wrote %s, %s, %s, %s, %s to %s\n", devpki.CAFile, devpki.ServerCertFile, devpki.ServerKeyFile,
		devpki.ClientCertFile, devpki.ClientKeyFile, filepath.Clean(*outDir))
	return nil
}
