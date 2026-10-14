package config

import (
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
)

const (
	envAgents     = "SANDBOX_ENGINE_AGENTS"
	envAgentSlots = "SANDBOX_ENGINE_AGENT_SLOTS"

	// architecture.md: one sandbox node (8 vCPU / 32 GB) holds about 64 sandboxes.
	defaultAgentSlots = 64
	// singleNodeName names the one agent given by SANDBOX_ENGINE_AGENT_ADDR.
	singleNodeName = "node-1"
	// maxNodeNameLength keeps "<node>/<agent's id>" within the 128 characters of a sandbox id.
	maxNodeNameLength = 32
)

var nodeNamePattern = regexp.MustCompile(`^[a-z0-9-]+$`)

// AgentNode is one sandbox agent and the name its sandbox ids carry.
type AgentNode struct {
	Name string
	Addr string
}

func loadAgent(getenv func(string) string) (AgentConfig, error) {
	agent := AgentConfig{ServerName: valueOr(getenv(envAgentServerName), defaultAgentServerName)}
	var err error
	if agent.Nodes, err = loadAgentNodes(getenv); err != nil {
		return AgentConfig{}, err
	}
	if agent.Slots, err = loadAgentSlots(getenv); err != nil {
		return AgentConfig{}, err
	}
	if agent.TLS, err = loadTLS(getenv); err != nil {
		return AgentConfig{}, err
	}
	return agent, nil
}

// loadAgentNodes reads SANDBOX_ENGINE_AGENTS ("node-1=10.1.0.5:9443,node-2=10.1.0.6:9443"), or, when it
// is not set, the single agent at SANDBOX_ENGINE_AGENT_ADDR.
func loadAgentNodes(getenv func(string) string) ([]AgentNode, error) {
	list := getenv(envAgents)
	if list == "" {
		addr, err := loadAddr(getenv, envAgentAddr, defaultAgentAddr)
		if err != nil {
			return nil, err
		}
		return []AgentNode{{Name: singleNodeName, Addr: addr}}, nil
	}
	if getenv(envAgentAddr) != "" {
		return nil, fmt.Errorf("%w: set %s or %s, not both", ErrInvalid, envAgents, envAgentAddr)
	}
	var nodes []AgentNode
	seen := map[string]bool{}
	for _, entry := range splitList(list) {
		node, err := parseAgentNode(entry)
		if err != nil {
			return nil, err
		}
		if seen[node.Name] {
			return nil, fmt.Errorf("%w: %s names node %q twice", ErrInvalid, envAgents, node.Name)
		}
		seen[node.Name] = true
		nodes = append(nodes, node)
	}
	if len(nodes) == 0 {
		return nil, fmt.Errorf("%w: %s lists no agents", ErrInvalid, envAgents)
	}
	return nodes, nil
}

func parseAgentNode(entry string) (AgentNode, error) {
	name, addr, found := strings.Cut(entry, "=")
	if !found || len(name) > maxNodeNameLength || !nodeNamePattern.MatchString(name) {
		return AgentNode{}, fmt.Errorf("%w: %s entry %q: want <name>=<host:port>, the name of a-z, 0-9 and - and at most %d characters",
			ErrInvalid, envAgents, entry, maxNodeNameLength)
	}
	if _, _, err := net.SplitHostPort(addr); err != nil {
		return AgentNode{}, fmt.Errorf("%w: %s node %q address %q: %w", ErrInvalid, envAgents, name, addr, err)
	}
	return AgentNode{Name: name, Addr: addr}, nil
}

func loadAgentSlots(getenv func(string) string) (int, error) {
	raw := getenv(envAgentSlots)
	if raw == "" {
		return defaultAgentSlots, nil
	}
	slots, err := strconv.Atoi(raw)
	if err != nil || slots <= 0 {
		return 0, fmt.Errorf("%w: %s %q: must be a positive whole number", ErrInvalid, envAgentSlots, raw)
	}
	return slots, nil
}
