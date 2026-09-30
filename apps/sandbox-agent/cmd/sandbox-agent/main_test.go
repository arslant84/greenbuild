package main

import (
	"context"
	"net/http"
	"testing"
	"time"
)

const testShutdownTimeout = time.Second

func TestServeStopsCleanlyWhenContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	server := &http.Server{Addr: "127.0.0.1:0", ReadHeaderTimeout: time.Second}

	done := make(chan error, 1)
	go func() { done <- serve(ctx, server, testShutdownTimeout) }()
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("serve() error = %v, want nil", err)
		}
	case <-time.After(testShutdownTimeout * 5):
		t.Fatal("serve() did not return after cancel")
	}
}

func TestServeReportsListenErrors(t *testing.T) {
	server := &http.Server{Addr: "not-an-address", ReadHeaderTimeout: time.Second}

	if err := serve(t.Context(), server, testShutdownTimeout); err == nil {
		t.Fatal("serve() error = nil, want listen error")
	}
}
