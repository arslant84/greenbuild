// Package queue holds the contracts for messages between the API (TypeScript) and the sandbox
// engine (Go). The JSON Schemas in schemas/ are the source of truth; every message is validated
// against them when it is read and before it is written.
package queue

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Stream names and the field that carries the JSON payload in each stream entry.
const (
	StreamSandboxCreate = "sandbox.create"
	StreamSandboxStatus = "sandbox.status"
	// StreamSandboxDestroy carries the API's requests to destroy a sandbox early.
	StreamSandboxDestroy = "sandbox.destroy"
	PayloadField         = "payload"
	Version              = 1
)

// Sandbox statuses the engine reports.
const (
	StatusReady     = "ready"
	StatusFailed    = "failed"
	StatusDestroyed = "destroyed"
)

// Reasons on a destroyed status: the challenge time limit ran out, the player was inactive too
// long, or the player gave up (the only reason the API sends on sandbox.destroy).
const (
	ReasonExpired   = "expired"
	ReasonIdle      = "idle"
	ReasonAbandoned = "abandoned"
)

const (
	createSchemaURL  = "https://greenbuild.dev/schemas/queue/sandbox.create.v1.json"
	statusSchemaURL  = "https://greenbuild.dev/schemas/queue/sandbox.status.v1.json"
	destroySchemaURL = "https://greenbuild.dev/schemas/queue/sandbox.destroy.v1.json"
)

//go:embed schemas/*.json
var schemaFiles embed.FS

// ErrInvalidMessage is wrapped when a payload does not match its schema.
var ErrInvalidMessage = errors.New("invalid queue message")

// SandboxCreate asks the engine to start and break a sandbox for an attempt.
type SandboxCreate struct {
	Version      int      `json:"version"`
	AttemptID    string   `json:"attempt_id"`
	Image        string   `json:"image"`
	Seed         uint64   `json:"seed"`
	CPUMillis    int64    `json:"cpu_millis"`
	MemoryBytes  int64    `json:"memory_bytes"`
	TTLSeconds   int64    `json:"ttl_seconds"`
	Network      string   `json:"network"`
	Capabilities []string `json:"capabilities,omitempty"`
}

// SandboxStatus tells the API what happened to an attempt's sandbox.
type SandboxStatus struct {
	Version   int    `json:"version"`
	AttemptID string `json:"attempt_id"`
	Status    string `json:"status"`
	SandboxID string `json:"sandbox_id,omitempty"`
	Reason    string `json:"reason,omitempty"`
}

// SandboxDestroy asks the engine to destroy an attempt's sandbox before its time limit.
type SandboxDestroy struct {
	Version   int    `json:"version"`
	AttemptID string `json:"attempt_id"`
	Reason    string `json:"reason"`
}

// Codec validates and converts messages; create one at startup and share it.
type Codec struct {
	create  *jsonschema.Schema
	status  *jsonschema.Schema
	destroy *jsonschema.Schema
}

// NewCodec compiles the embedded schemas.
func NewCodec() (*Codec, error) {
	compiler := jsonschema.NewCompiler()
	for _, file := range []struct{ name, url string }{
		{"schemas/sandbox.create.v1.json", createSchemaURL},
		{"schemas/sandbox.status.v1.json", statusSchemaURL},
		{"schemas/sandbox.destroy.v1.json", destroySchemaURL},
	} {
		raw, err := schemaFiles.ReadFile(file.name)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", file.name, err)
		}
		doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(raw))
		if err != nil {
			return nil, fmt.Errorf("parse %s: %w", file.name, err)
		}
		if err := compiler.AddResource(file.url, doc); err != nil {
			return nil, fmt.Errorf("add %s: %w", file.name, err)
		}
	}
	return compileAll(compiler)
}

func compileAll(compiler *jsonschema.Compiler) (*Codec, error) {
	create, err := compiler.Compile(createSchemaURL)
	if err != nil {
		return nil, fmt.Errorf("compile sandbox.create: %w", err)
	}
	status, err := compiler.Compile(statusSchemaURL)
	if err != nil {
		return nil, fmt.Errorf("compile sandbox.status: %w", err)
	}
	destroy, err := compiler.Compile(destroySchemaURL)
	if err != nil {
		return nil, fmt.Errorf("compile sandbox.destroy: %w", err)
	}
	return &Codec{create: create, status: status, destroy: destroy}, nil
}

// DecodeSandboxCreate validates a payload from the sandbox.create stream.
func (c *Codec) DecodeSandboxCreate(payload []byte) (SandboxCreate, error) {
	var message SandboxCreate
	if err := decode(c.create, payload, &message); err != nil {
		return SandboxCreate{}, err
	}
	return message, nil
}

// DecodeSandboxStatus validates a payload from the sandbox.status stream.
func (c *Codec) DecodeSandboxStatus(payload []byte) (SandboxStatus, error) {
	var message SandboxStatus
	if err := decode(c.status, payload, &message); err != nil {
		return SandboxStatus{}, err
	}
	return message, nil
}

// EncodeSandboxStatus refuses to write a message the API would reject.
func (c *Codec) EncodeSandboxStatus(message SandboxStatus) ([]byte, error) {
	return encode(c.status, message)
}

// EncodeSandboxCreate is what the API does; Go uses it in tests and tools.
func (c *Codec) EncodeSandboxCreate(message SandboxCreate) ([]byte, error) {
	return encode(c.create, message)
}

// DecodeSandboxDestroy validates a payload from the sandbox.destroy stream.
func (c *Codec) DecodeSandboxDestroy(payload []byte) (SandboxDestroy, error) {
	var message SandboxDestroy
	if err := decode(c.destroy, payload, &message); err != nil {
		return SandboxDestroy{}, err
	}
	return message, nil
}

// EncodeSandboxDestroy is what the API does; Go uses it in tests.
func (c *Codec) EncodeSandboxDestroy(message SandboxDestroy) ([]byte, error) {
	return encode(c.destroy, message)
}

func decode(schema *jsonschema.Schema, payload []byte, target any) error {
	if err := validate(schema, payload); err != nil {
		return err
	}
	if err := json.Unmarshal(payload, target); err != nil {
		return fmt.Errorf("%w: %w", ErrInvalidMessage, err)
	}
	return nil
}

func encode(schema *jsonschema.Schema, message any) ([]byte, error) {
	payload, err := json.Marshal(message)
	if err != nil {
		return nil, fmt.Errorf("marshal message: %w", err)
	}
	if err := validate(schema, payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func validate(schema *jsonschema.Schema, payload []byte) error {
	instance, err := jsonschema.UnmarshalJSON(bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("%w: not JSON: %w", ErrInvalidMessage, err)
	}
	if err := schema.Validate(instance); err != nil {
		return fmt.Errorf("%w: %w", ErrInvalidMessage, err)
	}
	return nil
}
