// Package storage defines interfaces for file storage.
package storage

import (
	"errors"
	"io"
)

// FileStorage abstracts file upload operations.
type FileStorage interface {
	// Save writes the contents of r to a file and returns its public URL path.
	// prefix is used to namespace the file (e.g. "logo", "banner").
	Save(r io.Reader, prefix, filename string) (string, error)
}

var (
	ErrInvalidFileType = errors.New("file must be JPEG, PNG, or WebP")
	ErrFileTooLarge    = errors.New("file must be 2MB or less")
)
