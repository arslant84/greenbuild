package check

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/arslant84/greenbuild/apps/sandbox-engine/internal/agentclient"
)

func post(t *testing.T, sandboxes *fakeSandboxes, body string) *httptest.ResponseRecorder {
	t.Helper()
	mux := http.NewServeMux()
	mux.Handle("POST /internal/attempts/{id}/check", Handler(NewChecker(sandboxes, challengesDir(t))))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/internal/attempts/att-1/check", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)
	return recorder
}

func TestHandlerReturnsTheCheckResult(t *testing.T) {
	sandboxes := &fakeSandboxes{result: agentclient.RunResult{ExitCode: 0, OutputTail: "the site is back\n"}}

	recorder := post(t, sandboxes, `{"sandbox_id":"sbx-1","challenge_id":"nginx-502-upstream"}`)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", recorder.Code, recorder.Body)
	}
	var result Result
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil || !result.Passed || result.OutputTail != "the site is back\n" {
		t.Errorf("body = %s (%v), want passed with the output", recorder.Body, err)
	}
}

func TestHandlerErrors(t *testing.T) {
	cases := map[string]struct {
		body      string
		sandboxes *fakeSandboxes
		status    int
		code      string
	}{
		"not json":          {`sbx-1`, &fakeSandboxes{}, http.StatusBadRequest, "validation_failed"},
		"no sandbox":        {`{"challenge_id":"nginx-502-upstream"}`, &fakeSandboxes{}, http.StatusBadRequest, "validation_failed"},
		"unknown challenge": {`{"sandbox_id":"sbx-1","challenge_id":"nope"}`, &fakeSandboxes{}, http.StatusNotFound, "not_found"},
		"agent down":        {`{"sandbox_id":"sbx-1","challenge_id":"nginx-502-upstream"}`, &fakeSandboxes{copyErr: errors.New("dial tcp 10.1.0.5:9443: refused")}, http.StatusInternalServerError, "internal"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			recorder := post(t, tc.sandboxes, tc.body)
			var body errorBody
			_ = json.Unmarshal(recorder.Body.Bytes(), &body)
			if recorder.Code != tc.status || body.Code != tc.code {
				t.Errorf("got %d %q, want %d %q", recorder.Code, body.Code, tc.status, tc.code)
			}
			if strings.Contains(recorder.Body.String(), "10.1.0.5") {
				t.Error("internal details leaked into the response")
			}
		})
	}
}
