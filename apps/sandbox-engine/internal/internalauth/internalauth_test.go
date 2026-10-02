package internalauth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var token = strings.Repeat("t", 32)

func call(t *testing.T, configured, authorization string) int {
	t.Helper()
	reached := false
	handler := Require(configured, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
		w.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/internal/attempts/att-1/check", nil)
	if authorization != "" {
		request.Header.Set("Authorization", authorization)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if reached != (recorder.Code == http.StatusNoContent) {
		t.Fatalf("handler reached = %v but status %d", reached, recorder.Code)
	}
	return recorder.Code
}

func TestRequireLetsTheRightTokenThrough(t *testing.T) {
	if code := call(t, token, "Bearer "+token); code != http.StatusNoContent {
		t.Errorf("status = %d, want the request to reach the handler", code)
	}
}

func TestRequireRefusesEverythingElse(t *testing.T) {
	cases := map[string]string{
		"no header":            "",
		"wrong token":          "Bearer " + strings.Repeat("x", 32),
		"token without scheme": token,
		"prefix of token":      "Bearer " + token[:31],
		"lowercase scheme":     "bearer " + token,
	}
	for name, header := range cases {
		t.Run(name, func(t *testing.T) {
			if code := call(t, token, header); code != http.StatusUnauthorized {
				t.Errorf("status = %d, want 401", code)
			}
		})
	}
}

func TestRequireWithoutAConfiguredTokenRefusesEvenAnEmptyBearer(t *testing.T) {
	if code := call(t, "", "Bearer "); code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", code)
	}
}
