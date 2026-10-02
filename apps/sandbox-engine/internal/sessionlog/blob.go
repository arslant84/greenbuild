package sessionlog

import (
	"bytes"
	"context"
	"errors"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/appendblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/bloberror"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/container"
)

// Container holds the session logs; the 90-day deletion is a lifecycle rule on it, set up with
// the storage account (architecture.md: raw session logs are deleted after 90 days).
const Container = "sessions"

const contentType = "application/x-ndjson"

// ErrConnectionString is returned for a connection string the SDK cannot use; the string itself
// holds the account key, so it is never part of the error.
var ErrConnectionString = errors.New("blob storage connection string is not valid")

// BlobStore saves session logs as append blobs, so each reconnect adds to the attempt's file.
type BlobStore struct {
	container *container.Client
}

// NewBlobStore connects to the sessions container; it does not create it.
func NewBlobStore(connectionString string) (*BlobStore, error) {
	client, err := container.NewClientFromConnectionString(connectionString, Container, nil)
	if err != nil {
		return nil, ErrConnectionString
	}
	return &BlobStore{container: client}, nil
}

// Append adds content as one block; a block may hold 4 MiB, more than a capped session.
func (s *BlobStore) Append(ctx context.Context, name string, content []byte) error {
	log := s.container.NewAppendBlobClient(name)
	if err := createOnce(ctx, log); err != nil {
		return fmt.Errorf("create %s: %w", name, err)
	}
	if _, err := log.AppendBlock(ctx, streaming.NopCloser(bytes.NewReader(content)), nil); err != nil {
		return fmt.Errorf("append to %s: %w", name, err)
	}
	return nil
}

// createOnce creates the blob only if it is missing: creating an existing append blob empties it.
func createOnce(ctx context.Context, log *appendblob.Client) error {
	anyETag := azcore.ETagAny
	mime := contentType
	_, err := log.Create(ctx, &appendblob.CreateOptions{
		HTTPHeaders: &blob.HTTPHeaders{BlobContentType: &mime},
		AccessConditions: &blob.AccessConditions{
			ModifiedAccessConditions: &blob.ModifiedAccessConditions{IfNoneMatch: &anyETag},
		},
	})
	if err != nil && !bloberror.HasCode(err, bloberror.BlobAlreadyExists, bloberror.ConditionNotMet) {
		return fmt.Errorf("create append blob: %w", err)
	}
	return nil
}
