package main

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

var testSecret = []byte(strings.Repeat("dev-secret-", 4))

func newLauncher(t *testing.T) launcher {
	t.Helper()
	codec, err := queue.NewCodec()
	if err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: miniredis.RunT(t).Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return launcher{redis: rdb, codec: codec, image: "challenge:dev"}
}

// answer plays the engine: once sandbox.create arrives, it publishes statuses built from the attempt id.
func answer(t *testing.T, l launcher, statuses func(attemptID string) []string) {
	t.Helper()
	go func() {
		streams, err := l.redis.XRead(context.Background(), &redis.XReadArgs{Streams: []string{queue.StreamSandboxCreate, "0"}, Block: 5 * time.Second}).Result()
		if err != nil {
			return
		}
		create, err := l.codec.DecodeSandboxCreate([]byte(streams[0].Messages[0].Values[queue.PayloadField].(string)))
		if err != nil {
			return
		}
		for _, payload := range statuses(create.AttemptID) {
			l.redis.XAdd(context.Background(), &redis.XAddArgs{Stream: queue.StreamSandboxStatus, Values: map[string]any{queue.PayloadField: payload}})
		}
	}()
}

func TestStartWaitsForItsOwnReadyStatus(t *testing.T) {
	l := newLauncher(t)
	answer(t, l, func(attemptID string) []string {
		return []string{
			`{"version":1,"attempt_id":"someone-else","status":"ready","sandbox_id":"sbx-other"}`,
			`not json`,
			`{"version":1,"attempt_id":"` + attemptID + `","status":"ready","sandbox_id":"sbx-mine"}`,
		}
	})
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	attemptID, sandboxID, err := l.start(ctx)
	if err != nil || sandboxID != "sbx-mine" || !strings.HasPrefix(attemptID, "dev-") {
		t.Errorf("start() = %q, %q, %v; want a dev attempt with sbx-mine", attemptID, sandboxID, err)
	}
}

func TestStartReportsAFailedSandbox(t *testing.T) {
	l := newLauncher(t)
	answer(t, l, func(attemptID string) []string {
		return []string{`{"version":1,"attempt_id":"` + attemptID + `","status":"failed","reason":"image not found"}`}
	})
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	if _, _, err := l.start(ctx); !errors.Is(err, errSandboxFailed) || !strings.Contains(err.Error(), "image not found") {
		t.Errorf("start() error = %v, want errSandboxFailed with the reason", err)
	}
}

func TestAttachTokenIsAcceptedByTheEngine(t *testing.T) {
	granted := grant{attemptID: "dev-1", sandboxID: "sbx-1", challengeID: challengeID}
	token, err := signAttach(testSecret, granted, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := attachtoken.NewVerifier(testSecret)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := verifier.Verify(token); err != nil || got != (attachtoken.Attach{SandboxID: "sbx-1", AttemptID: "dev-1", UserID: devUser}) {
		t.Errorf("Verify() = %+v, %v", got, err)
	}
}

func TestTicketIsBoundToTheAttempt(t *testing.T) {
	granted := grant{attemptID: "dev-1", sandboxID: "sbx-1", challengeID: challengeID}
	token, err := signTicket(testSecret, granted, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	var claims ticketClaims
	_, err = jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) { return testSecret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithAudience(ticketAudience), jwt.WithExpirationRequired())
	if err != nil || claims.AttemptID != "dev-1" || claims.SandboxID != "sbx-1" || claims.ChallengeID != challengeID {
		t.Errorf("ticket claims = %+v, %v", claims, err)
	}
}

func TestStatusesFromStartsAMillisecondEarlier(t *testing.T) {
	for published, want := range map[string]string{"1790920854720-0": "1790920854719", "1-3": "0", "garbage": "0"} {
		if got := statusesFrom(published); got != want {
			t.Errorf("statusesFrom(%q) = %q, want %q", published, got, want)
		}
	}
}
