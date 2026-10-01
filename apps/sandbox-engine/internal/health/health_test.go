package health

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	Register(mux)
	return mux
}

func TestHealthReturnsOK(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)

	newMux().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if got := recorder.Body.String(); got != `{"status":"ok"}` {
		t.Errorf("body = %s, want {\"status\":\"ok\"}", got)
	}
	if got := recorder.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
}

func TestHealthRejectsOtherMethods(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/health", nil)

	newMux().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
}
