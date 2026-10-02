package sessionlog

import (
	"errors"
	"strings"
	"testing"
)

func TestNewBlobStoreHidesABadConnectionString(t *testing.T) {
	bad := "AccountName=greenbuild;AccountKey=s3cret-key"
	_, err := NewBlobStore(bad)
	if !errors.Is(err, ErrConnectionString) || strings.Contains(err.Error(), "s3cret") {
		t.Errorf("NewBlobStore() error = %v, want ErrConnectionString without the key", err)
	}
}
