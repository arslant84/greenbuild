package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attach"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
)

type touches struct{ attempts []string }

func (t *touches) Touch(_ context.Context, attemptID string) error {
	t.attempts = append(t.attempts, attemptID)
	return nil
}

func TestTypingCountsAsActivityAtMostEvery30Seconds(t *testing.T) {
	activity := &touches{}
	clock := time.Unix(1_800_000_000, 0)
	recording := activityRecordings(activity, func() time.Time { return clock })(attachtoken.Attach{AttemptID: "att-1"})

	recording.Input([]byte("l"))
	clock = clock.Add(29 * time.Second)
	recording.Input([]byte("s"))
	clock = clock.Add(time.Second)
	recording.Input([]byte("\r"))

	if want := []string{"att-1", "att-1"}; !reflect.DeepEqual(activity.attempts, want) {
		t.Errorf("touches = %v, want %v (first key, then 30 s later)", activity.attempts, want)
	}
}

func TestACheckCountsAsActivity(t *testing.T) {
	activity := &touches{}
	ran := false
	mux := http.NewServeMux()
	mux.Handle("POST /internal/attempts/{id}/check", touchingChecks(activity, http.HandlerFunc(func(http.ResponseWriter, *http.Request) { ran = true })))

	mux.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/internal/attempts/att-7/check", nil))
	if !ran || !reflect.DeepEqual(activity.attempts, []string{"att-7"}) {
		t.Errorf("check ran = %v, touches = %v; want the check run and att-7 touched", ran, activity.attempts)
	}
}

type countingRecording struct{ inputs, exits, finishes int }

func (r *countingRecording) Input([]byte)           { r.inputs++ }
func (r *countingRecording) Exit(int32)             { r.exits++ }
func (r *countingRecording) Finish(context.Context) { r.finishes++ }

func TestAllRecordingsForwardsToEachOneThatIsOn(t *testing.T) {
	first, second := &countingRecording{}, &countingRecording{}
	start := allRecordings(
		func(attachtoken.Attach) attach.Recording { return first },
		nil,
		func(attachtoken.Attach) attach.Recording { return second },
	)
	recording := start(attachtoken.Attach{})
	recording.Input([]byte("x"))
	recording.Exit(0)
	recording.Finish(t.Context())

	want := countingRecording{inputs: 1, exits: 1, finishes: 1}
	if *first != want || *second != want {
		t.Errorf("first = %+v, second = %+v; want %+v each", *first, *second, want)
	}
}

func TestNoRecordingWhenNothingIsOn(t *testing.T) {
	if allRecordings(nil, nil) != nil {
		t.Error("allRecordings(nil, nil) is not nil")
	}
}
