package main

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
)

const (
	// activityEvery bounds how often typing reaches Redis; far below the idle timeout.
	activityEvery = 30 * time.Second
	// touchTimeout keeps a slow Redis from stalling a keystroke.
	touchTimeout = time.Second
)

// toucher records player activity for the idle timeout; the queue consumer implements it.
type toucher interface {
	Touch(ctx context.Context, attemptID string) error
}

// activityRecordings makes terminal input count as player activity.
func activityRecordings(activity toucher, now func() time.Time) attach.StartRecording {
	return func(granted attachtoken.Attach) attach.Recording {
		return &activityRecording{activity: activity, attemptID: granted.AttemptID, now: now}
	}
}

type activityRecording struct {
	activity  toucher
	attemptID string
	now       func() time.Time
	last      time.Time
}

func (r *activityRecording) Input([]byte) {
	now := r.now()
	if now.Sub(r.last) < activityEvery {
		return
	}
	r.last = now
	touch(r.activity, r.attemptID)
}

func (r *activityRecording) Exit(int32)             {}
func (r *activityRecording) Finish(context.Context) {}

// touchingChecks makes a check request count as player activity before it runs.
func touchingChecks(activity toucher, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		touch(activity, r.PathValue("id"))
		next.ServeHTTP(w, r)
	})
}

// touch never fails the player's action: a missed touch only risks an early idle timeout.
func touch(activity toucher, attemptID string) {
	ctx, cancel := context.WithTimeout(context.Background(), touchTimeout)
	defer cancel()
	if err := activity.Touch(ctx, attemptID); err != nil {
		slog.Warn("record player activity", "attempt", attemptID, "error", err)
	}
}

// allRecordings combines the recordings that are on; nil when none is.
func allRecordings(starts ...attach.StartRecording) attach.StartRecording {
	var active []attach.StartRecording
	for _, start := range starts {
		if start != nil {
			active = append(active, start)
		}
	}
	if len(active) == 0 {
		return nil
	}
	return func(granted attachtoken.Attach) attach.Recording {
		recordings := make(recordingList, 0, len(active))
		for _, start := range active {
			recordings = append(recordings, start(granted))
		}
		return recordings
	}
}

type recordingList []attach.Recording

func (list recordingList) Input(data []byte) {
	for _, recording := range list {
		recording.Input(data)
	}
}

func (list recordingList) Exit(code int32) {
	for _, recording := range list {
		recording.Exit(code)
	}
}

func (list recordingList) Finish(ctx context.Context) {
	for _, recording := range list {
		recording.Finish(ctx)
	}
}
