package queue

import (
	"encoding/json"
	"errors"
	"reflect"
	"slices"
	"strings"
	"testing"
)

func codec(t *testing.T) *Codec {
	t.Helper()
	c, err := NewCodec()
	if err != nil {
		t.Fatalf("NewCodec() error = %v", err)
	}
	return c
}

func validCreate() SandboxCreate {
	return SandboxCreate{
		Version: Version, AttemptID: "att-1", Image: "acr.io/challenge@sha256:abc", Seed: 4242,
		CPUMillis: 500, MemoryBytes: 512 << 20, TTLSeconds: 900, Network: "none",
		Capabilities: []string{"CHOWN", "SETUID", "SETGID"},
	}
}

func TestSandboxCreateRoundTrips(t *testing.T) {
	c := codec(t)
	payload, err := c.EncodeSandboxCreate(validCreate())
	if err != nil {
		t.Fatalf("Encode() error = %v", err)
	}
	decoded, err := c.DecodeSandboxCreate(payload)
	if err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if !reflect.DeepEqual(decoded, validCreate()) {
		t.Errorf("round trip = %+v, want %+v", decoded, validCreate())
	}
}

func TestSandboxCreateRejectsBadPayloads(t *testing.T) {
	base := `"version":1,"attempt_id":"att-1","image":"img","cpu_millis":500,"memory_bytes":536870912,"ttl_seconds":900,"network":"none"`
	cases := map[string]string{
		"missing seed":         `{` + base + `}`,
		"unknown field":        `{` + base + `,"seed":1,"privileged":true}`,
		"host network":         strings.Replace(`{`+base+`,"seed":1}`, `"none"`, `"host"`, 1),
		"negative seed":        `{` + base + `,"seed":-1}`,
		"seed beyond 2^53-1":   `{` + base + `,"seed":9007199254740992}`,
		"forbidden capability": `{` + base + `,"seed":1,"capabilities":["SYS_ADMIN"]}`,
		"repeated capability":  `{` + base + `,"seed":1,"capabilities":["CHOWN","CHOWN"]}`,
		"other version":        strings.Replace(`{`+base+`,"seed":1}`, `"version":1`, `"version":2`, 1),
		"zero cpu":             strings.Replace(`{`+base+`,"seed":1}`, `"cpu_millis":500`, `"cpu_millis":0`, 1),
		"not json":             `version=1`,
	}
	c := codec(t)
	for name, payload := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := c.DecodeSandboxCreate([]byte(payload)); !errors.Is(err, ErrInvalidMessage) {
				t.Errorf("Decode() error = %v, want ErrInvalidMessage", err)
			}
		})
	}
}

func TestSandboxStatusRules(t *testing.T) {
	c := codec(t)
	valid := []SandboxStatus{
		{Version: Version, AttemptID: "att-1", Status: StatusReady, SandboxID: "sbx-1"},
		{Version: Version, AttemptID: "att-1", Status: StatusFailed, Reason: "image not found"},
		{Version: Version, AttemptID: "att-1", Status: StatusDestroyed},
	}
	for _, message := range valid {
		if _, err := c.EncodeSandboxStatus(message); err != nil {
			t.Errorf("Encode(%+v) error = %v", message, err)
		}
	}
	invalid := map[string]SandboxStatus{
		"ready without sandbox": {Version: Version, AttemptID: "att-1", Status: StatusReady},
		"unknown status":        {Version: Version, AttemptID: "att-1", Status: "running"},
		"reason too long":       {Version: Version, AttemptID: "att-1", Status: StatusFailed, Reason: strings.Repeat("x", 501)},
		"no attempt":            {Version: Version, Status: StatusDestroyed},
	}
	for name, message := range invalid {
		if _, err := c.EncodeSandboxStatus(message); !errors.Is(err, ErrInvalidMessage) {
			t.Errorf("%s: Encode() error = %v, want ErrInvalidMessage", name, err)
		}
	}
}

// The Go types must match the schemas field for field; this fails when one changes without the other.
func TestGoTypesMatchTheSchemas(t *testing.T) {
	cases := map[string]any{"schemas/sandbox.create.v1.json": SandboxCreate{}, "schemas/sandbox.status.v1.json": SandboxStatus{}}
	for file, value := range cases {
		raw, err := schemaFiles.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		var schema struct {
			Required   []string                   `json:"required"`
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(raw, &schema); err != nil {
			t.Fatalf("parse %s: %v", file, err)
		}
		fields, required := jsonFields(reflect.TypeOf(value))
		properties := make([]string, 0, len(schema.Properties))
		for name := range schema.Properties {
			properties = append(properties, name)
		}
		slices.Sort(properties)
		slices.Sort(schema.Required)
		if !slices.Equal(fields, properties) || !slices.Equal(required, schema.Required) {
			t.Errorf("%s: Go fields %v (required %v), schema properties %v (required %v)", file, fields, required, properties, schema.Required)
		}
	}
}

// jsonFields lists a struct's JSON names; fields without omitempty are the required ones.
func jsonFields(typ reflect.Type) ([]string, []string) {
	var fields, required []string
	for field := range typ.Fields() {
		name, options, _ := strings.Cut(field.Tag.Get("json"), ",")
		fields = append(fields, name)
		if !strings.Contains(options, "omitempty") {
			required = append(required, name)
		}
	}
	slices.Sort(fields)
	slices.Sort(required)
	return fields, required
}
