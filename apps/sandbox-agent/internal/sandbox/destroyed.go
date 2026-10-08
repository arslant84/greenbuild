package sandbox

import "sync"

// ReasonAbuse is reported for a sandbox destroyed for using all of its CPU (architecture.md, task 33f).
const ReasonAbuse = "abuse"

// Destroyed is a sandbox the agent destroyed on its own, and why.
type Destroyed struct {
	SandboxID string
	Reason    string
}

// destroyedJournal holds what the control plane has not taken yet. It lives in memory: after an
// agent restart the engine's own deadlines still end those attempts.
type destroyedJournal struct {
	mu      sync.Mutex
	entries []Destroyed
}

func (j *destroyedJournal) record(entry Destroyed) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.entries = append(j.entries, entry)
}

func (j *destroyedJournal) take() []Destroyed {
	j.mu.Lock()
	defer j.mu.Unlock()
	taken := j.entries
	j.entries = nil
	return taken
}

// TakeDestroyed returns the sandboxes destroyed on the agent's own initiative since the last call.
func (m *Manager) TakeDestroyed() []Destroyed {
	return m.destroyed.take()
}
