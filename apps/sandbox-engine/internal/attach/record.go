package attach

import (
	"context"
	"fmt"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
)

// Recording receives what the player typed and how the shell ended; see sessionlog.
type Recording interface {
	Input(data []byte)
	Exit(code int32)
	Finish(ctx context.Context)
}

// StartRecording begins the recording of one attach session.
type StartRecording func(attach attachtoken.Attach) Recording

// RecordSessions makes every session record its input; call it before serving. Without it
// nothing is recorded.
func (h *Handler) RecordSessions(start StartRecording) {
	h.record = start
}

func (h *Handler) startRecording(attach attachtoken.Attach) Recording {
	if h.record == nil {
		return noRecording{}
	}
	return h.record(attach)
}

type noRecording struct{}

func (noRecording) Input([]byte)           {}
func (noRecording) Exit(int32)             {}
func (noRecording) Finish(context.Context) {}

// recorded copies the input the shell accepted and its exit code to the recording.
type recorded struct {
	Session
	recording Recording
}

func (s recorded) Write(input []byte) (int, error) {
	written, err := s.Session.Write(input)
	if err != nil {
		return written, fmt.Errorf("write to terminal: %w", err)
	}
	s.recording.Input(input)
	return written, nil
}

func (s recorded) Recv() (agentclient.Event, error) {
	event, err := s.Session.Recv()
	if err != nil {
		return event, fmt.Errorf("read from terminal: %w", err)
	}
	if event.Exited {
		s.recording.Exit(event.ExitCode)
	}
	return event, nil
}
