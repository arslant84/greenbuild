package config

import (
	"errors"
	"slices"
	"testing"
)

func TestLoadAgentList(t *testing.T) {
	cfg, err := Load(envFrom(map[string]string{
		envAgents:     "node-a=10.1.0.5:9443, node-b=10.1.0.6:9443",
		envAgentSlots: "40",
	}))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	want := []AgentNode{{Name: "node-a", Addr: "10.1.0.5:9443"}, {Name: "node-b", Addr: "10.1.0.6:9443"}}
	if !slices.Equal(cfg.Agent.Nodes, want) || cfg.Agent.Slots != 40 {
		t.Errorf("Agent nodes %v with %d slots, want %v with 40", cfg.Agent.Nodes, cfg.Agent.Slots, want)
	}
}

func TestLoadRejectsInvalidAgentLists(t *testing.T) {
	cases := map[string]map[string]string{
		"list and single address": {envAgents: "node-a=10.1.0.5:9443", envAgentAddr: "10.1.0.6:9443"},
		"entry without a name":    {envAgents: "10.1.0.5:9443"},
		"name with a slash":       {envAgents: "rack/1=10.1.0.5:9443"},
		"name too long":           {envAgents: "node-0123456789-0123456789-0123456789=10.1.0.5:9443"},
		"address without port":    {envAgents: "node-a=10.1.0.5"},
		"same name twice":         {envAgents: "node-a=10.1.0.5:9443,node-a=10.1.0.6:9443"},
		"no entries":              {envAgents: " , "},
		"zero slots":              {envAgentSlots: "0"},
		"slots not a number":      {envAgentSlots: "many"},
	}
	for name, env := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Load(envFrom(env)); !errors.Is(err, ErrInvalid) {
				t.Errorf("Load() error = %v, want ErrInvalid", err)
			}
		})
	}
}
