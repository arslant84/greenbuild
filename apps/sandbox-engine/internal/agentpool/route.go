package agentpool

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
)

// ErrUnknownNode is returned for a sandbox id that names a node the pool does not have; NotFound, as
// that sandbox cannot be reached any more.
var ErrUnknownNode = status.Error(codes.NotFound, "sandbox id names an unknown agent node")

// route finds the node a sandbox id names and the agent's own id for it.
func (p *Pool) route(sandboxID string) (*node, string, error) {
	name, agentID, named := strings.Cut(sandboxID, idSeparator)
	if !named {
		if len(p.nodes) == 0 {
			return nil, "", fmt.Errorf("%w: sandbox %s", ErrUnknownNode, sandboxID)
		}
		return p.nodes[0], sandboxID, nil
	}
	for _, n := range p.nodes {
		if n.Name == name {
			return n, agentID, nil
		}
	}
	return nil, "", fmt.Errorf("%w: %s", ErrUnknownNode, name)
}

// noteFailure marks n unavailable when err says its agent could not be reached.
func (p *Pool) noteFailure(n *node, err error) {
	if status.Code(err) == codes.Unavailable {
		p.markUnavailable(n, err)
	}
}

// Destroy destroys the sandbox on the node that holds it, freeing its slot.
func (p *Pool) Destroy(ctx context.Context, sandboxID string) error {
	n, agentID, err := p.route(sandboxID)
	if err != nil {
		return err
	}
	if err := n.Agent.Destroy(ctx, agentID); err != nil {
		p.noteFailure(n, err)
		return fmt.Errorf("destroy on node %s: %w", n.Name, err)
	}
	p.markAvailable(n, -1)
	return nil
}

// TakeDestroyed collects what every node destroyed on its own. A node that fails keeps its reports for
// the next call, so the others' are still returned; it is an error only when every node failed.
func (p *Pool) TakeDestroyed(ctx context.Context) ([]agentclient.Destroyed, error) {
	var taken []agentclient.Destroyed
	var failures []error
	for _, n := range p.nodes {
		reports, err := n.Agent.TakeDestroyed(ctx)
		if err != nil {
			p.noteFailure(n, err)
			slog.Warn("take destroyed sandboxes from node failed", "node", n.Name, "error", err)
			failures = append(failures, fmt.Errorf("node %s: %w", n.Name, err))
			continue
		}
		p.markAvailable(n, -len(reports))
		for _, report := range reports {
			taken = append(taken, agentclient.Destroyed{SandboxID: joinID(n.Name, report.SandboxID), Reason: report.Reason})
		}
	}
	if len(p.nodes) > 0 && len(failures) == len(p.nodes) {
		return nil, errors.Join(failures...)
	}
	return taken, nil
}

// CopyIn writes file into the sandbox on the node that holds it.
func (p *Pool) CopyIn(ctx context.Context, sandboxID string, file agentclient.File) error {
	n, agentID, err := p.route(sandboxID)
	if err != nil {
		return err
	}
	if err := n.Agent.CopyIn(ctx, agentID, file); err != nil {
		return fmt.Errorf("on node %s: %w", n.Name, err)
	}
	return nil
}

// Run executes command in the sandbox on the node that holds it.
func (p *Pool) Run(ctx context.Context, sandboxID string, command agentclient.Command) (agentclient.RunResult, error) {
	n, agentID, err := p.route(sandboxID)
	if err != nil {
		return agentclient.RunResult{}, err
	}
	result, err := n.Agent.Run(ctx, agentID, command)
	if err != nil {
		return agentclient.RunResult{}, fmt.Errorf("on node %s: %w", n.Name, err)
	}
	return result, nil
}

// OpenTerminal opens a shell in the sandbox on the node that holds it.
func (p *Pool) OpenTerminal(ctx context.Context, sandboxID string, size agentclient.TerminalSize) (*agentclient.Terminal, error) {
	n, agentID, err := p.route(sandboxID)
	if err != nil {
		return nil, err
	}
	terminal, err := n.Agent.OpenTerminal(ctx, agentID, size)
	if err != nil {
		return nil, fmt.Errorf("on node %s: %w", n.Name, err)
	}
	return terminal, nil
}
