// Package local implements file storage on the local filesystem.
package local

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/fhedul/amaarshop/backend/internal/storage"
)

// Storage writes uploaded files to a directory on the local filesystem.
type Storage struct {
	dir string // absolute path to the upload directory
}

// New creates a local file storage rooted at dir, creating it if necessary.
func New(dir string) (*Storage, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("creating upload dir: %w", err)
	}
	return &Storage{dir: dir}, nil
}

// Save writes the file to disk with a random name preserving the original extension.
// Returns the URL path relative to the server root (e.g. "/uploads/logo-a1b2c3.png").
func (s *Storage) Save(r io.Reader, prefix, filename string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		return "", storage.ErrInvalidFileType
	}

	randBytes := make([]byte, 8)
	if _, err := rand.Read(randBytes); err != nil {
		return "", fmt.Errorf("generating random name: %w", err)
	}
	safeName := fmt.Sprintf("%s-%s%s", prefix, hex.EncodeToString(randBytes), ext)

	dst, err := os.Create(filepath.Join(s.dir, safeName))
	if err != nil {
		return "", fmt.Errorf("creating file: %w", err)
	}
	defer dst.Close()

	// Limit to 2MB + 1 byte to detect oversized files.
	const maxSize = 2 << 20 // 2 MB
	limited := io.LimitReader(r, maxSize+1)

	n, err := io.Copy(dst, limited)
	if err != nil {
		os.Remove(dst.Name())
		return "", fmt.Errorf("writing file: %w", err)
	}
	if n > maxSize {
		os.Remove(dst.Name())
		return "", storage.ErrFileTooLarge
	}

	return "/uploads/" + safeName, nil
}

// SaveReceipt accepts image (jpg/png/webp) or PDF files up to 5 MB.
// Used for advance-fee payment receipt uploads.
func (s *Storage) SaveReceipt(r io.Reader, filename string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".pdf" {
		return "", storage.ErrInvalidFileType
	}

	randBytes := make([]byte, 8)
	if _, err := rand.Read(randBytes); err != nil {
		return "", fmt.Errorf("generating random name: %w", err)
	}
	safeName := fmt.Sprintf("receipt-%s%s", hex.EncodeToString(randBytes), ext)

	dst, err := os.Create(filepath.Join(s.dir, safeName))
	if err != nil {
		return "", fmt.Errorf("creating file: %w", err)
	}
	defer dst.Close()

	const maxSize = 5 << 20 // 5 MB
	limited := io.LimitReader(r, maxSize+1)

	n, err := io.Copy(dst, limited)
	if err != nil {
		os.Remove(dst.Name())
		return "", fmt.Errorf("writing file: %w", err)
	}
	if n > maxSize {
		os.Remove(dst.Name())
		return "", storage.ErrFileTooLarge
	}

	return "/uploads/" + safeName, nil
}
