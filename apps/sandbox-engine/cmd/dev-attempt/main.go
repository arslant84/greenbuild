// Command dev-attempt starts an nginx-502 attempt the way the API will, and prints the play
// page URL with its tokens. It stands in for the API until tasks 14–16 (architecture.md,
// task 12: "token from a dev script for now").
//
// With the agent and the engine (consumer on) running against the same Redis:
//
//	docker build -t greenbuild-challenge/nginx-502-upstream:dev challenges/nginx-502-upstream
//	SANDBOX_ENGINE_REDIS_URL=redis://127.0.0.1:6379 SANDBOX_ENGINE_ATTACH_SECRET=... \
//	GREENBUILD_DEV_CHECK_SECRET=... go run ./cmd/dev-attempt [-image ...] [-web http://localhost:3001]
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/attachtoken"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

const (
	envRedisURL     = "SANDBOX_ENGINE_REDIS_URL"
	envAttachSecret = "SANDBOX_ENGINE_ATTACH_SECRET"
	envTicketSecret = "GREENBUILD_DEV_CHECK_SECRET"
	challengeID     = "nginx-502-upstream"
	defaultImage    = "greenbuild-challenge/nginx-502-upstream:dev"
	defaultWebURL   = "http://localhost:3001"
	startTimeout    = 3 * time.Minute
	connectReminder = "open it within 60 seconds: the attach token is only for connecting"
)

var errSettings = errors.New("invalid settings")

type settings struct {
	redis        *redis.Options
	attachSecret []byte
	ticketSecret []byte
	image        string
	webURL       string
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "dev-attempt:", err)
		os.Exit(1)
	}
}

func run() error {
	s, err := loadSettings()
	if err != nil {
		return err
	}
	codec, err := queue.NewCodec()
	if err != nil {
		return fmt.Errorf("queue codec: %w", err)
	}
	rdb := redis.NewClient(s.redis)
	defer func() { _ = rdb.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), startTimeout)
	defer cancel()

	attemptID, sandboxID, err := launcher{redis: rdb, codec: codec, image: s.image}.start(ctx)
	if err != nil {
		return err
	}
	playURL, err := issue(s, grant{attemptID: attemptID, sandboxID: sandboxID, challengeID: challengeID})
	if err != nil {
		return err
	}
	fmt.Println(playURL)
	fmt.Fprintln(os.Stderr, connectReminder)
	return nil
}

// loadSettings reports secrets by name and length only.
func loadSettings() (settings, error) {
	image := flag.String("image", defaultImage, "challenge image (build it from challenges/nginx-502-upstream)")
	webURL := flag.String("web", defaultWebURL, "web app base URL")
	flag.Parse()
	redisOptions, err := redis.ParseURL(os.Getenv(envRedisURL))
	if err != nil {
		return settings{}, fmt.Errorf("%w: %s is not a redis:// URL", errSettings, envRedisURL)
	}
	s := settings{redis: redisOptions, attachSecret: []byte(os.Getenv(envAttachSecret)), ticketSecret: []byte(os.Getenv(envTicketSecret)), image: *image, webURL: *webURL}
	for name, secret := range map[string][]byte{envAttachSecret: s.attachSecret, envTicketSecret: s.ticketSecret} {
		if len(secret) < attachtoken.MinSecretBytes {
			return settings{}, fmt.Errorf("%w: %s is %d bytes, need at least %d", errSettings, name, len(secret), attachtoken.MinSecretBytes)
		}
	}
	return s, nil
}

// issue signs both tokens and builds the play page URL.
func issue(s settings, granted grant) (string, error) {
	now := time.Now()
	attach, err := signAttach(s.attachSecret, granted, now)
	if err != nil {
		return "", err
	}
	ticket, err := signTicket(s.ticketSecret, granted, now)
	if err != nil {
		return "", err
	}
	query := url.Values{"token": {attach}, "ticket": {ticket}}
	return s.webURL + "/play/" + url.PathEscape(granted.attemptID) + "?" + query.Encode(), nil
}
