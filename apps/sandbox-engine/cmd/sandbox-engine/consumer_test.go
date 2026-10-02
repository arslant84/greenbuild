package main

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/config"
	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/consumer"
	"github.com/arslant84/greenbuild/packages/queue"
	"github.com/redis/go-redis/v9"
)

func TestBuildConsumerIsOffWithoutRedis(t *testing.T) {
	queueConsumer, release, err := buildConsumer(config.Config{}, nil)
	if err != nil || queueConsumer != nil {
		t.Fatalf("buildConsumer() = %v, %v; want no consumer", queueConsumer, err)
	}
	release()
}

func TestBuildConsumerNeedsTheAgent(t *testing.T) {
	_, _, err := buildConsumer(config.Config{Redis: &redis.Options{Addr: "127.0.0.1:6379"}}, nil)
	if !errors.Is(err, errNeedsAgent) {
		t.Errorf("buildConsumer() error = %v, want errNeedsAgent", err)
	}
}

func TestConsumerFailureStopsTheServer(t *testing.T) {
	stopped := miniredis.RunT(t)
	addr := stopped.Addr()
	stopped.Close()
	redisClient := redis.NewClient(&redis.Options{Addr: addr, MaxRetries: -1})
	t.Cleanup(func() { _ = redisClient.Close() })
	codec, err := queue.NewCodec()
	if err != nil {
		t.Fatal(err)
	}
	queueConsumer := consumer.New(consumer.Options{Redis: redisClient, Codec: codec, Name: "engine-test"})

	done := make(chan error, 1)
	go func() {
		done <- runWithConsumer(t.Context(), queueConsumer, func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		})
	}()
	select {
	case err := <-done:
		if err == nil {
			t.Error("runWithConsumer() error = nil, want the consumer's Redis error")
		}
	case <-time.After(testShutdownTimeout * 5):
		t.Fatal("the server kept running after the consumer stopped")
	}
}
