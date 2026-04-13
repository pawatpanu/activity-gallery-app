package utils

import (
	"os"
	"path"
	"strconv"
	"sync"

	"github.com/pkg/errors"
)

// CachePathForMedia is a low-level implementation for Media.CachePath()
func CachePathForMedia(albumID int, mediaID int) (string, error) {
	albumCachePath := path.Join(MediaCachePath(), strconv.Itoa(int(albumID)))
	photoCachePath := path.Join(albumCachePath, strconv.Itoa(int(mediaID)))
	if err := os.MkdirAll(photoCachePath, os.ModePerm); err != nil {
		return "", errors.Wrap(err, "could not make media cache directory")
	}

	return photoCachePath, nil
}

var (
	testCachePath       string = ""
	testCachePathLocker sync.RWMutex
)

func GetTestCachePath() string {
	testCachePathLocker.RLock()
	defer testCachePathLocker.RUnlock()
	return testCachePath
}

func ConfigureTestCache(tmpDir string) {
	testCachePathLocker.Lock()
	defer testCachePathLocker.Unlock()
	testCachePath = tmpDir
}

// MediaCachePath returns the path for where the media cache is located on the file system
func MediaCachePath() string {
	testCachePathLocker.RLock()
	cachedPath := testCachePath
	testCachePathLocker.RUnlock()
	if cachedPath != "" {
		return cachedPath
	}

	photoCache := EnvMediaCachePath.GetValue()
	if photoCache == "" {
		photoCache = "./media_cache"
	}

	return photoCache
}
