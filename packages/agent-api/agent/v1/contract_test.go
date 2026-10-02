package agentv1_test

import (
	"slices"
	"testing"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"
	"google.golang.org/protobuf/proto"
)

// The control plane and the agent are deployed separately, so the contract must not change by accident.
func TestServiceHasTheAgreedMethods(t *testing.T) {
	service := agentv1.File_agent_v1_agent_proto.Services().ByName("SandboxAgent")
	if service == nil {
		t.Fatal("service SandboxAgent not found")
	}

	var names []string
	for i := range service.Methods().Len() {
		names = append(names, string(service.Methods().Get(i).Name()))
	}
	want := []string{"CreateSandbox", "Destroy", "Exec", "CopyIn", "Health", "Run"}
	if !slices.Equal(names, want) {
		t.Errorf("methods = %v, want %v", names, want)
	}

	exec := service.Methods().ByName("Exec")
	if !exec.IsStreamingClient() || !exec.IsStreamingServer() {
		t.Error("Exec must stream in both directions: stdin and resizes in, output out")
	}
}

func TestSetupSeedDistinguishesUnsetFromZero(t *testing.T) {
	zero := uint64(0)
	withZero, err := proto.Marshal(&agentv1.CreateSandboxRequest{Image: "alpine:3", SetupSeed: &zero})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded agentv1.CreateSandboxRequest
	if err := proto.Unmarshal(withZero, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if decoded.SetupSeed == nil {
		t.Error("seed 0 decoded as unset; setup would be skipped for a valid seed")
	}
}
