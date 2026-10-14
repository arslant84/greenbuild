// Package agentpool spreads sandboxes over several sandbox agents (architecture.md, task 57a). A sandbox
// id names its node ("<node>/<agent's id>"), so every later call reaches the agent that holds it, also
// after the engine restarts.
package agentpool

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	agentv1 "github.com/arslant84/greenbuild/packages/agent-api/agent/v1"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
)

// idSeparator joins a node's name and the agent's sandbox id; agent ids never contain it.
const idSeparator = "/"

// ErrNoCapacity is returned when no node has a free slot; Unavailable, so the queue consumer tries the
// start again later.
var ErrNoCapacity = status.Error(codes.Unavailable, "no agent node has a free slot")

// Agent is what the pool needs from one agent (agentclient.Client).
type Agent interface {
	CreateSandbox(ctx context.Context, req *agentv1.CreateSandboxRequest) (string, error)
	Destroy(ctx context.Context, sandboxID string) error
	TakeDestroyed(ctx context.Context) ([]agentclient.Destroyed, error)
	CopyIn(ctx context.Context, sandboxID string, file agentclient.File) error
	Run(ctx context.Context, sandboxID string, command agentclient.Command) (agentclient.RunResult, error)
	OpenTerminal(ctx context.Context, sandboxID string, size agentclient.TerminalSize) (*agentclient.Terminal, error)
}

// Node is one agent with its name and how many sandboxes it may hold.
type Node struct {
	Name  string
	Agent Agent
	Slots int
}

type node struct {
	Node
	active      int
	unavailable bool
}

func (n *node) free() int {
	return n.Slots - n.active
}

// Pool chooses a node for each new sandbox and routes every other call by the sandbox id. It counts only
// the sandboxes it started or saw destroyed since the engine started.
type Pool struct {
	mu    sync.Mutex
	nodes []*node
}

// New returns a pool over nodes, in the order given. The first node also takes sandbox ids without a
// node name, made before the engine knew several agents.
func New(nodes []Node) *Pool {
	pool := &Pool{}
	for _, n := range nodes {
		pool.nodes = append(pool.nodes, &node{Node: n})
	}
	return pool
}

// CreateSandbox starts the sandbox on the node with the most free slots, trying the next one when an
// agent cannot be reached; such a node is tried last until it answers again.
func (p *Pool) CreateSandbox(ctx context.Context, req *agentv1.CreateSandboxRequest) (string, error) {
	for _, candidate := range p.candidates() {
		id, err := candidate.Agent.CreateSandbox(ctx, req)
		if err == nil {
			p.markAvailable(candidate, 1)
			return joinID(candidate.Name, id), nil
		}
		if status.Code(err) != codes.Unavailable {
			return "", fmt.Errorf("create sandbox on node %s: %w", candidate.Name, err)
		}
		p.markUnavailable(candidate, err)
	}
	return "", fmt.Errorf("create sandbox: %w", ErrNoCapacity)
}

func joinID(nodeName, agentID string) string {
	return nodeName + idSeparator + agentID
}

// candidates are the nodes with a free slot: available ones first, then by most free slots.
func (p *Pool) candidates() []*node {
	p.mu.Lock()
	defer p.mu.Unlock()
	var withSlot []*node
	for _, n := range p.nodes {
		if n.free() > 0 {
			withSlot = append(withSlot, n)
		}
	}
	sort.SliceStable(withSlot, func(i, j int) bool {
		if withSlot[i].unavailable != withSlot[j].unavailable {
			return !withSlot[i].unavailable
		}
		return withSlot[i].free() > withSlot[j].free()
	})
	return withSlot
}

// markAvailable records that n answered, with started more (or, negative, fewer) sandboxes on it.
func (p *Pool) markAvailable(n *node, started int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if n.unavailable {
		slog.Info("agent node available again", "node", n.Name)
	}
	n.unavailable = false
	n.active = max(0, n.active+started)
}

func (p *Pool) markUnavailable(n *node, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !n.unavailable {
		slog.Warn("agent node unavailable", "node", n.Name, "error", err)
	}
	n.unavailable = true
}
