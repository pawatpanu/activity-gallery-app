package routes

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	graphql_auth "github.com/photoview/photoview/api/graphql/auth"
	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/scanner/face_detection"
	"github.com/photoview/photoview/api/scanner/scanner_queue"
	"github.com/photoview/photoview/api/utils"
	"gorm.io/gorm"
)

const maxUploadMemory = 256 << 20 // 256 MB

type activityGalleryRoot struct {
	Title      string                  `json:"title"`
	Path       string                  `json:"path"`
	Activities []activityGalleryFolder `json:"activities,omitempty"`
}

type activityGalleryFolder struct {
	Title        string `json:"title"`
	RelativePath string `json:"relativePath"`
}

type activityGalleryConfigResponse struct {
	Roots []activityGalleryRoot `json:"roots"`
}

type createAlbumRequest struct {
	RootPath     string `json:"rootPath"`
	// ParentPath is kept as a backward-compatible internal field for older
	// clients. The user-facing business concept is now "activity name".
	ParentPath   string `json:"parentPath"`
	ActivityName string `json:"activityName"`
	ActivityPath string `json:"activityPath"`
	AlbumName    string `json:"albumName"`
}

type createAlbumResponse struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	RelativePath string `json:"relativePath"`
	RootPath     string `json:"rootPath,omitempty"`
	ActivityPath string `json:"activityPath,omitempty"`
}

type uploadMediaResponse struct {
	Success      bool     `json:"success"`
	Message      string   `json:"message"`
	RelativePath string   `json:"relativePath"`
	Files        []string `json:"files"`
}

type activityGalleryAlbumOption struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Path  string `json:"path"`
	Depth int    `json:"depth"`
}

type activityGalleryAlbumsResponse struct {
	Albums []activityGalleryAlbumOption `json:"albums"`
}

type moveMediaRequest struct {
	DestinationAlbumID int `json:"destinationAlbumId"`
}

type activityGalleryHealthResponse struct {
	GeneratedAt      time.Time                       `json:"generatedAt"`
	Totals           activityGalleryHealthTotals     `json:"totals"`
	Roots            []activityGalleryRootHealth     `json:"roots"`
	DuplicateGroups  []activityGalleryDuplicateGroup `json:"duplicateGroups"`
	QualityWarnings  []activityGalleryMediaWarning   `json:"qualityWarnings"`
}

type activityGalleryHealthTotals struct {
	AlbumCount          int     `json:"albumCount"`
	MediaCount          int     `json:"mediaCount"`
	MediaBytes          int64   `json:"mediaBytes"`
	DiskTotalBytes      int64   `json:"diskTotalBytes"`
	DiskUsedBytes       int64   `json:"diskUsedBytes"`
	DiskFreeBytes       int64   `json:"diskFreeBytes"`
	DiskUsagePercent    float64 `json:"diskUsagePercent"`
	DuplicateGroups     int     `json:"duplicateGroups"`
	DuplicateMediaCount int     `json:"duplicateMediaCount"`
	QualityWarningCount int     `json:"qualityWarningCount"`
	MissingFileCount    int     `json:"missingFileCount"`
}

type activityGalleryRootHealth struct {
	Title            string  `json:"title"`
	Path             string  `json:"path"`
	AlbumCount       int     `json:"albumCount"`
	MediaCount       int     `json:"mediaCount"`
	MediaBytes       int64   `json:"mediaBytes"`
	DirectoryBytes   int64   `json:"directoryBytes"`
	DiskTotalBytes   int64   `json:"diskTotalBytes"`
	DiskUsedBytes    int64   `json:"diskUsedBytes"`
	DiskFreeBytes    int64   `json:"diskFreeBytes"`
	DiskUsagePercent float64 `json:"diskUsagePercent"`
}

type activityGalleryDuplicateGroup struct {
	Key        string                       `json:"key"`
	FileSize  int64                        `json:"fileSize"`
	Title     string                       `json:"title"`
	Media     []activityGalleryMediaNotice `json:"media"`
}

type activityGalleryMediaWarning struct {
	activityGalleryMediaNotice
	Reason string `json:"reason"`
}

type activityGalleryMediaNotice struct {
	ID         int    `json:"id"`
	Title      string `json:"title"`
	AlbumID    int    `json:"albumId"`
	AlbumTitle string `json:"albumTitle"`
	AlbumPath  string `json:"albumPath"`
	Path       string `json:"path"`
	FileSize   int64  `json:"fileSize"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
}

type activityGalleryHealthMediaRow struct {
	ID         int
	Title      string
	Path       string
	AlbumID    int
	AlbumTitle string
	AlbumPath  string
	Type       string
	FileSize   int64
	Width      int
	Height     int
}

func RegisterActivityGalleryRoutes(db *gorm.DB, router *mux.Router) {
	router.HandleFunc("/config", activityGalleryConfigHandler(db)).Methods(http.MethodGet)
	router.HandleFunc("/albums", activityGalleryAlbumsHandler(db)).Methods(http.MethodGet)
	router.HandleFunc("/health", activityGalleryHealthHandler(db)).Methods(http.MethodGet)
	router.HandleFunc("/albums", createAlbumHandler(db)).Methods(http.MethodPost)
	router.HandleFunc("/albums/{id}/children", createChildAlbumHandler(db)).Methods(http.MethodPost)
	router.HandleFunc("/albums/{id}/upload", uploadAlbumMediaHandler(db)).Methods(http.MethodPost)
	router.HandleFunc("/albums/{id}", deleteAlbumHandler(db)).Methods(http.MethodDelete)
	router.HandleFunc("/media/{id}/move", moveMediaHandler(db)).Methods(http.MethodPost, http.MethodPatch)
	router.HandleFunc("/media/{id}", deleteMediaHandler(db)).Methods(http.MethodDelete)
	router.HandleFunc("/upload", uploadMediaHandler(db)).Methods(http.MethodPost)
}

func activityGalleryConfigHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		roots, err := userOwnedRootAlbums(db, user)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		resp := activityGalleryConfigResponse{
			Roots: make([]activityGalleryRoot, 0, len(roots)),
		}
		for _, root := range roots {
			activities, activitiesErr := directChildActivities(db, root)
			if activitiesErr != nil {
				writeJSONError(w, http.StatusInternalServerError, activitiesErr.Error())
				return
			}

			resp.Roots = append(resp.Roots, activityGalleryRoot{
				Title:      root.Title,
				Path:       root.Path,
				Activities: activities,
			})
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

func activityGalleryAlbumsHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		albums, err := userOwnedAlbumsFlat(db, user)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, activityGalleryAlbumsResponse{
			Albums: albums,
		})
	}
}

func activityGalleryHealthHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		roots, err := userOwnedRootAlbums(db, user)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		rootHealth := make([]activityGalleryRootHealth, 0, len(roots))
		albumIDs := make([]int, 0)
		seenAlbums := make(map[int]struct{})
		rootByAlbumID := make(map[int]int)

		for _, root := range roots {
			children, childrenErr := root.GetChildren(db, nil)
			if childrenErr != nil {
				writeJSONError(w, http.StatusInternalServerError, childrenErr.Error())
				return
			}

			currentRoot := activityGalleryRootHealth{
				Title: root.Title,
				Path:  root.Path,
			}
			for _, album := range children {
				currentRoot.AlbumCount++
				rootByAlbumID[album.ID] = len(rootHealth)
				if _, exists := seenAlbums[album.ID]; exists {
					continue
				}
				seenAlbums[album.ID] = struct{}{}
				albumIDs = append(albumIDs, album.ID)
			}

			currentRoot.DirectoryBytes = directorySize(root.Path)
			total, free, used, diskErr := diskUsageForPath(root.Path)
			if diskErr == nil {
				currentRoot.DiskTotalBytes = total
				currentRoot.DiskFreeBytes = free
				currentRoot.DiskUsedBytes = used
				currentRoot.DiskUsagePercent = percentOf(used, total)
			}
			rootHealth = append(rootHealth, currentRoot)
		}

		rows, err := activityGalleryHealthMediaRows(db, albumIDs)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		totals := activityGalleryHealthTotals{
			AlbumCount: len(seenAlbums),
			MediaCount: len(rows),
		}
		duplicateBuckets := make(map[string][]activityGalleryMediaNotice)
		duplicateFileSizes := make(map[string]int64)
		duplicateTitles := make(map[string]string)
		qualityWarnings := make([]activityGalleryMediaWarning, 0)

		for _, row := range rows {
			notice := mediaNoticeFromHealthRow(row)
			if notice.FileSize == 0 {
				if info, statErr := os.Stat(row.Path); statErr == nil && !info.IsDir() {
					notice.FileSize = info.Size()
				}
			}

			totals.MediaBytes += notice.FileSize
			if rootIndex, exists := rootByAlbumID[row.AlbumID]; exists {
				rootHealth[rootIndex].MediaCount++
				rootHealth[rootIndex].MediaBytes += notice.FileSize
			}

			if _, statErr := os.Stat(row.Path); statErr != nil {
				if os.IsNotExist(statErr) {
					totals.MissingFileCount++
					qualityWarnings = append(qualityWarnings, activityGalleryMediaWarning{
						activityGalleryMediaNotice: notice,
						Reason: "ไม่พบไฟล์ต้นฉบับ",
					})
				}
				continue
			}

			if notice.FileSize > 0 {
				key := duplicateKey(notice)
				duplicateBuckets[key] = append(duplicateBuckets[key], notice)
				duplicateFileSizes[key] = notice.FileSize
				duplicateTitles[key] = notice.Title
			}

			if reason := mediaQualityWarningReason(row, notice); reason != "" {
				qualityWarnings = append(qualityWarnings, activityGalleryMediaWarning{
					activityGalleryMediaNotice: notice,
					Reason: reason,
				})
			}
		}

		duplicateGroups := make([]activityGalleryDuplicateGroup, 0)
		for key, media := range duplicateBuckets {
			if len(media) < 2 {
				continue
			}
			duplicateGroups = append(duplicateGroups, activityGalleryDuplicateGroup{
				Key:       key,
				FileSize: duplicateFileSizes[key],
				Title:    duplicateTitles[key],
				Media:    media,
			})
			totals.DuplicateMediaCount += len(media)
		}

		sort.Slice(duplicateGroups, func(i, j int) bool {
			if len(duplicateGroups[i].Media) == len(duplicateGroups[j].Media) {
				return duplicateGroups[i].Title < duplicateGroups[j].Title
			}
			return len(duplicateGroups[i].Media) > len(duplicateGroups[j].Media)
		})
		sort.Slice(qualityWarnings, func(i, j int) bool {
			if qualityWarnings[i].Reason == qualityWarnings[j].Reason {
				return qualityWarnings[i].Title < qualityWarnings[j].Title
			}
			return qualityWarnings[i].Reason < qualityWarnings[j].Reason
		})

		totals.DuplicateGroups = len(duplicateGroups)
		totals.QualityWarningCount = len(qualityWarnings)
		if len(duplicateGroups) > 25 {
			duplicateGroups = duplicateGroups[:25]
		}
		if len(qualityWarnings) > 50 {
			qualityWarnings = qualityWarnings[:50]
		}

		seenDisks := make(map[string]struct{})
		for _, root := range rootHealth {
			if root.DiskTotalBytes > 0 {
				diskKey := fmt.Sprintf("%d:%d:%d", root.DiskTotalBytes, root.DiskFreeBytes, root.DiskUsedBytes)
				if _, exists := seenDisks[diskKey]; exists {
					continue
				}
				seenDisks[diskKey] = struct{}{}
				totals.DiskTotalBytes += root.DiskTotalBytes
				totals.DiskFreeBytes += root.DiskFreeBytes
				totals.DiskUsedBytes += root.DiskUsedBytes
			}
		}
		totals.DiskUsagePercent = percentOf(totals.DiskUsedBytes, totals.DiskTotalBytes)

		writeJSON(w, http.StatusOK, activityGalleryHealthResponse{
			GeneratedAt:     time.Now(),
			Totals:          totals,
			Roots:           rootHealth,
			DuplicateGroups: duplicateGroups,
			QualityWarnings: qualityWarnings,
		})
	}
}

func createAlbumHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		var req createAlbumRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		rootPath, err := authorizedRootPath(db, user, req.RootPath)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		relativeParentPath, err := resolveActivityRelativePath(req)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		albumName, err := sanitizeStorageSegment(req.AlbumName)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "album name is required")
			return
		}

		activityDir, resolvedActivityPath, err := resolveAuthorizedChildPath(rootPath, relativeParentPath, "")
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := os.MkdirAll(activityDir, 0o755); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not create activity directory: %v", err))
			return
		}

		targetDir, relativeAlbumPath, err := resolveAuthorizedChildPath(rootPath, resolvedActivityPath, albumName)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		if info, statErr := os.Stat(targetDir); statErr == nil && info.IsDir() {
			writeJSONError(w, http.StatusConflict, "album already exists in this activity")
			return
		}

		if err := os.MkdirAll(targetDir, 0o755); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not create album directory: %v", err))
			return
		}

		if err := scanner_queue.AddUserToQueue(user); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("album created but scanner queue failed: %v", err))
			return
		}

		writeJSON(w, http.StatusOK, createAlbumResponse{
			Success:      true,
			Message:      "Album created and scanner queued",
			RelativePath: relativeAlbumPath,
			RootPath:     rootPath,
			ActivityPath: resolvedActivityPath,
		})
	}
}

func createChildAlbumHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		albumID, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil || albumID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid album id")
			return
		}

		var req createAlbumRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		albumName, err := sanitizeStorageSegment(req.AlbumName)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "album name is required")
			return
		}

		rootAlbums, err := userOwnedRootAlbums(db, user)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var parentAlbum models.Album
		if err := db.First(&parentAlbum, albumID).Error; err != nil {
			writeJSONError(w, http.StatusNotFound, "album not found")
			return
		}

		var matchedRoot *models.Album
		cleanAlbumPath := path.Clean(parentAlbum.Path)
		for _, root := range rootAlbums {
			cleanRootPath := path.Clean(root.Path)
			if cleanAlbumPath == cleanRootPath || strings.HasPrefix(cleanAlbumPath, cleanRootPath+"/") {
				matchedRoot = root
				break
			}
		}

		if matchedRoot == nil {
			writeJSONError(w, http.StatusForbidden, "album is not owned by the current user")
			return
		}

		rootPath := path.Clean(matchedRoot.Path)
		relativeParentPath := strings.TrimPrefix(strings.TrimPrefix(cleanAlbumPath, rootPath), "/")

		targetDir, relativeAlbumPath, err := resolveAuthorizedChildPath(rootPath, relativeParentPath, albumName)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		if info, statErr := os.Stat(targetDir); statErr == nil && info.IsDir() {
			writeJSONError(w, http.StatusConflict, "album already exists in this activity")
			return
		}

		if err := os.MkdirAll(targetDir, 0o755); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not create album directory: %v", err))
			return
		}

		if err := scanner_queue.AddUserToQueue(user); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("album created but scanner queue failed: %v", err))
			return
		}

		writeJSON(w, http.StatusOK, createAlbumResponse{
			Success:      true,
			Message:      "Album created and scanner queued",
			RelativePath: relativeAlbumPath,
			RootPath:     rootPath,
			ActivityPath: relativeParentPath,
		})
	}
}

func uploadMediaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		if err := r.ParseMultipartForm(maxUploadMemory); err != nil {
			writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid multipart form: %v", err))
			return
		}

		rootPath, err := authorizedRootPath(db, user, r.FormValue("rootPath"))
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		relativeAlbumPath, err := normalizeRelativePath(r.FormValue("albumPath"))
		if err != nil || relativeAlbumPath == "" {
			writeJSONError(w, http.StatusBadRequest, "album path is required")
			return
		}

		targetDir, _, err := resolveAuthorizedChildPath(rootPath, relativeAlbumPath, "")
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		stat, err := os.Stat(targetDir)
		if err != nil || !stat.IsDir() {
			writeJSONError(w, http.StatusBadRequest, "target album directory does not exist")
			return
		}

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			writeJSONError(w, http.StatusBadRequest, "at least one file is required")
			return
		}

		savedFiles := make([]string, 0, len(files))
		for _, fileHeader := range files {
			src, err := fileHeader.Open()
			if err != nil {
				writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not open upload: %v", err))
				return
			}

			func() {
				defer src.Close()
				fileName := sanitizeUploadFilename(fileHeader.Filename)
				if fileName == "" {
					err = fmt.Errorf("invalid upload filename")
					return
				}

				destPath, uniqueName, pathErr := uniqueDestinationPath(targetDir, fileName)
				if pathErr != nil {
					err = pathErr
					return
				}

				dst, createErr := os.Create(destPath)
				if createErr != nil {
					err = createErr
					return
				}
				defer dst.Close()

				if _, copyErr := io.Copy(dst, src); copyErr != nil {
					err = copyErr
					return
				}

				_ = os.Chmod(destPath, 0o644)
				savedFiles = append(savedFiles, uniqueName)
			}()

			if err != nil {
				writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not save upload: %v", err))
				return
			}
		}

		if err := scanner_queue.AddUserToQueue(user); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("files uploaded but scanner queue failed: %v", err))
			return
		}

		writeJSON(w, http.StatusOK, uploadMediaResponse{
			Success:      true,
			Message:      fmt.Sprintf("Uploaded %d file(s) and queued scanner", len(savedFiles)),
			RelativePath: relativeAlbumPath,
			Files:        savedFiles,
		})
	}
}

func uploadAlbumMediaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		albumID, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil || albumID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid album id")
			return
		}

		if err := r.ParseMultipartForm(maxUploadMemory); err != nil {
			writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("invalid multipart form: %v", err))
			return
		}

		album, _, err := ownedAlbumForUser(db, user, albumID)
		if err != nil {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}

		stat, err := os.Stat(album.Path)
		if err != nil || !stat.IsDir() {
			writeJSONError(w, http.StatusBadRequest, "target album directory does not exist")
			return
		}

		savedFiles, err := saveUploadedFilesToDirectory(r, album.Path)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not save upload: %v", err))
			return
		}

		if err := scanner_queue.AddUserToQueue(user); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("files uploaded but scanner queue failed: %v", err))
			return
		}

		writeJSON(w, http.StatusOK, uploadMediaResponse{
			Success:      true,
			Message:      fmt.Sprintf("Uploaded %d file(s) and queued scanner", len(savedFiles)),
			RelativePath: album.Path,
			Files:        savedFiles,
		})
	}
}

func deleteAlbumHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		albumID, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil || albumID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid album id")
			return
		}

		rootAlbums, err := userOwnedRootAlbums(db, user)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		var targetAlbum models.Album
		if err := db.First(&targetAlbum, albumID).Error; err != nil {
			writeJSONError(w, http.StatusNotFound, "album not found")
			return
		}

		owned := false
		for _, root := range rootAlbums {
			cleanRootPath := path.Clean(root.Path)
			cleanAlbumPath := path.Clean(targetAlbum.Path)
			if cleanAlbumPath == cleanRootPath || strings.HasPrefix(cleanAlbumPath, cleanRootPath+"/") {
				owned = true
				break
			}
		}

		if !owned {
			writeJSONError(w, http.StatusForbidden, "album is not owned by the current user")
			return
		}

		if err := os.RemoveAll(targetAlbum.Path); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not delete album directory: %v", err))
			return
		}

		children, err := targetAlbum.GetChildren(db, nil)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not load album tree: %v", err))
			return
		}

		deleteAlbumIDs := make([]int, 0, len(children))
		for _, album := range children {
			deleteAlbumIDs = append(deleteAlbumIDs, album.ID)
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			return tx.Delete(&models.Album{}, "id IN (?)", deleteAlbumIDs).Error
		})
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not delete album records: %v", err))
			return
		}

		for _, id := range deleteAlbumIDs {
			cacheAlbumPath := path.Join(utils.MediaCachePath(), strconv.Itoa(id))
			_ = os.RemoveAll(cacheAlbumPath)
		}

		if face_detection.GlobalFaceDetector != nil {
			if err := face_detection.GlobalFaceDetector.ReloadFacesFromDatabase(db); err != nil {
				writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("album deleted but face reload failed: %v", err))
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Album deleted successfully",
		})
	}
}

func moveMediaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		mediaID, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil || mediaID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid media id")
			return
		}

		var req moveMediaRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.DestinationAlbumID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "destination album is required")
			return
		}

		var media models.Media
		if err := db.First(&media, mediaID).Error; err != nil {
			writeJSONError(w, http.StatusNotFound, "media not found")
			return
		}

		sourceAlbum, _, err := ownedAlbumForUser(db, user, media.AlbumID)
		if err != nil {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}

		destinationAlbum, _, err := ownedAlbumForUser(db, user, req.DestinationAlbumID)
		if err != nil {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}

		if sourceAlbum.ID == destinationAlbum.ID {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"success": true,
				"message": "Media is already in the selected album",
			})
			return
		}

		stat, err := os.Stat(destinationAlbum.Path)
		if err != nil || !stat.IsDir() {
			writeJSONError(w, http.StatusBadRequest, "destination album directory does not exist")
			return
		}

		originalCachePath, _ := media.CachePath()
		destinationPath, destinationName, err := uniqueDestinationPath(destinationAlbum.Path, path.Base(media.Path))
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if err := moveMediaFile(media.Path, destinationPath); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not move media file: %v", err))
			return
		}

		previousPath := media.Path
		previousAlbumID := media.AlbumID
		media.Path = destinationPath
		media.Title = destinationName
		media.AlbumID = destinationAlbum.ID

		err = db.Transaction(func(tx *gorm.DB) error {
			if sourceAlbum.CoverID != nil && *sourceAlbum.CoverID == media.ID {
				if err := tx.Model(&models.Album{}).Where("id = ?", sourceAlbum.ID).Update("cover_id", nil).Error; err != nil {
					return err
				}
			}

			return tx.Save(&media).Error
		})
		if err != nil {
			_ = moveMediaFile(destinationPath, previousPath)
			media.Path = previousPath
			media.AlbumID = previousAlbumID
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not update media record: %v", err))
			return
		}

		if originalCachePath != "" {
			_ = os.RemoveAll(originalCachePath)
		}

		if err := scanner_queue.AddUserToQueue(user); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("media moved but scanner queue failed: %v", err))
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Media moved successfully",
			"mediaId": media.ID,
			"albumId": destinationAlbum.ID,
		})
	}
}

func deleteMediaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireAdminUser(w, r)
		if !ok {
			return
		}

		mediaID, err := strconv.Atoi(mux.Vars(r)["id"])
		if err != nil || mediaID <= 0 {
			writeJSONError(w, http.StatusBadRequest, "invalid media id")
			return
		}

		var media models.Media
		if err := db.First(&media, mediaID).Error; err != nil {
			writeJSONError(w, http.StatusNotFound, "media not found")
			return
		}

		album, _, err := ownedAlbumForUser(db, user, media.AlbumID)
		if err != nil {
			writeJSONError(w, http.StatusForbidden, err.Error())
			return
		}

		if err := removeMediaFile(media.Path); err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not delete media file: %v", err))
			return
		}

		cachePath, _ := media.CachePath()

		err = db.Transaction(func(tx *gorm.DB) error {
			if album.CoverID != nil && *album.CoverID == media.ID {
				if err := tx.Model(&models.Album{}).Where("id = ?", album.ID).Update("cover_id", nil).Error; err != nil {
					return err
				}
			}

			return tx.Delete(&models.Media{}, media.ID).Error
		})
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("could not delete media record: %v", err))
			return
		}

		if cachePath != "" {
			_ = os.RemoveAll(cachePath)
		}

		if face_detection.GlobalFaceDetector != nil {
			if err := face_detection.GlobalFaceDetector.ReloadFacesFromDatabase(db); err != nil {
				writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("media deleted but face reload failed: %v", err))
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success": true,
			"message": "Media deleted successfully",
		})
	}
}

func requireAdminUser(w http.ResponseWriter, r *http.Request) (*models.User, bool) {
	user := graphql_auth.UserFromContext(r.Context())
	if user == nil {
		writeJSONError(w, http.StatusUnauthorized, "unauthorized")
		return nil, false
	}
	if !user.Admin {
		writeJSONError(w, http.StatusForbidden, "admin privileges required")
		return nil, false
	}
	return user, true
}

func userOwnedRootAlbums(db *gorm.DB, user *models.User) ([]*models.Album, error) {
	var albums []*models.Album
	err := db.Model(user).
		Where("albums.parent_album_id NOT IN (?)",
			db.Table("user_albums").
				Select("albums.id").
				Joins("JOIN albums ON albums.id = user_albums.album_id AND user_albums.user_id = ?", user.ID),
		).Or("albums.parent_album_id IS NULL").Order("path ASC").
		Association("Albums").Find(&albums)
	return albums, err
}

func userOwnedAlbumsFlat(db *gorm.DB, user *models.User) ([]activityGalleryAlbumOption, error) {
	roots, err := userOwnedRootAlbums(db, user)
	if err != nil {
		return nil, err
	}

	seen := make(map[int]struct{})
	albums := make([]activityGalleryAlbumOption, 0)
	for _, root := range roots {
		children, err := root.GetChildren(db, nil)
		if err != nil {
			return nil, err
		}

		rootPath := path.Clean(root.Path)
		for _, album := range children {
			if _, exists := seen[album.ID]; exists {
				continue
			}
			seen[album.ID] = struct{}{}

			cleanAlbumPath := path.Clean(album.Path)
			relativePath := strings.TrimPrefix(strings.TrimPrefix(cleanAlbumPath, rootPath), "/")
			depth := 0
			if relativePath != "" {
				depth = strings.Count(relativePath, "/") + 1
			}

			albums = append(albums, activityGalleryAlbumOption{
				ID:    album.ID,
				Title: album.Title,
				Path:  album.Path,
				Depth: depth,
			})
		}
	}

	sort.Slice(albums, func(i, j int) bool {
		return albums[i].Path < albums[j].Path
	})

	return albums, nil
}

func directChildActivities(db *gorm.DB, root *models.Album) ([]activityGalleryFolder, error) {
	var childAlbums []models.Album
	if err := db.Where("parent_album_id = ?", root.ID).Order("title ASC").Find(&childAlbums).Error; err != nil {
		return nil, err
	}

	activities := make([]activityGalleryFolder, 0, len(childAlbums))
	cleanRootPath := path.Clean(root.Path)
	for _, album := range childAlbums {
		relativePath := strings.TrimPrefix(strings.TrimPrefix(path.Clean(album.Path), cleanRootPath), "/")
		if relativePath == "" {
			continue
		}

		activities = append(activities, activityGalleryFolder{
			Title:        album.Title,
			RelativePath: relativePath,
		})
	}

	return activities, nil
}

func authorizedRootPath(db *gorm.DB, user *models.User, rootPath string) (string, error) {
	rootPath = path.Clean(strings.TrimSpace(rootPath))
	if rootPath == "." || rootPath == "" {
		return "", fmt.Errorf("root path is required")
	}

	roots, err := userOwnedRootAlbums(db, user)
	if err != nil {
		return "", err
	}
	for _, root := range roots {
		if path.Clean(root.Path) == rootPath {
			return rootPath, nil
		}
	}

	return "", fmt.Errorf("root path is not owned by the current user")
}

// resolveActivityRelativePath maps the Thai business concept "activity name"
// to the existing internal folder path structure used by the scanner.
func resolveActivityRelativePath(req createAlbumRequest) (string, error) {
	activityPath, err := normalizeRelativePath(req.ActivityPath)
	if err != nil {
		return "", err
	}
	if activityPath != "" {
		return activityPath, nil
	}

	if strings.TrimSpace(req.ActivityName) != "" {
		return sanitizeStorageSegment(req.ActivityName)
	}

	// Backward-compatible fallback for older clients that still send parentPath.
	legacyParentPath, err := normalizeRelativePath(req.ParentPath)
	if err != nil {
		return "", err
	}
	if legacyParentPath != "" {
		return legacyParentPath, nil
	}

	return "", fmt.Errorf("activity name is required")
}

func ownedAlbumForUser(db *gorm.DB, user *models.User, albumID int) (*models.Album, string, error) {
	rootAlbums, err := userOwnedRootAlbums(db, user)
	if err != nil {
		return nil, "", err
	}

	var album models.Album
	if err := db.First(&album, albumID).Error; err != nil {
		return nil, "", fmt.Errorf("album not found")
	}

	cleanAlbumPath := path.Clean(album.Path)
	for _, root := range rootAlbums {
		cleanRootPath := path.Clean(root.Path)
		if cleanAlbumPath == cleanRootPath || strings.HasPrefix(cleanAlbumPath, cleanRootPath+"/") {
			return &album, cleanRootPath, nil
		}
	}

	return nil, "", fmt.Errorf("album is not owned by the current user")
}

func normalizeRelativePath(relativePath string) (string, error) {
	relativePath = strings.TrimSpace(strings.ReplaceAll(relativePath, "\\", "/"))
	if relativePath == "" {
		return "", nil
	}
	if strings.HasPrefix(relativePath, "/") {
		return "", fmt.Errorf("relative path must not start with /")
	}
	cleaned := path.Clean(relativePath)
	if cleaned == "." {
		return "", nil
	}
	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", fmt.Errorf("relative path must stay inside the media root")
	}
	return cleaned, nil
}

func sanitizeStorageSegment(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("value is required")
	}

	replacer := strings.NewReplacer(
		"/", "-",
		"\\", "-",
		":", "-",
		"*", "-",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "-",
	)
	value = replacer.Replace(value)
	value = strings.Join(strings.Fields(value), " ")
	value = strings.Trim(value, ". ")
	if value == "" || value == "." || value == ".." {
		return "", fmt.Errorf("value is required")
	}

	return value, nil
}

func resolveAuthorizedChildPath(rootPath string, relativeParentPath string, childName string) (string, string, error) {
	rootPath = path.Clean(rootPath)
	relativePath := relativeParentPath
	if childName != "" {
		if relativePath == "" {
			relativePath = childName
		} else {
			relativePath = path.Join(relativePath, childName)
		}
	}

	fullPath := path.Clean(path.Join(rootPath, relativePath))
	if fullPath != rootPath && !strings.HasPrefix(fullPath, rootPath+"/") {
		return "", "", fmt.Errorf("target path escapes the media root")
	}

	relativeResolved := strings.TrimPrefix(strings.TrimPrefix(fullPath, rootPath), "/")
	return fullPath, relativeResolved, nil
}

func sanitizeUploadFilename(name string) string {
	name = strings.TrimSpace(path.Base(strings.ReplaceAll(name, "\\", "/")))
	if name == "." || name == ".." {
		return ""
	}
	return name
}

func uniqueDestinationPath(dir string, fileName string) (string, string, error) {
	ext := path.Ext(fileName)
	base := strings.TrimSuffix(fileName, ext)
	candidate := fileName

	for i := 0; i < 1000; i++ {
		fullPath := path.Join(dir, candidate)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			return fullPath, candidate, nil
		}

		candidate = fmt.Sprintf("%s-%d-%d%s", base, time.Now().Unix(), i+1, ext)
	}

	return "", "", fmt.Errorf("could not resolve unique filename for %s", fileName)
}

func saveUploadedFilesToDirectory(r *http.Request, targetDir string) ([]string, error) {
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		return nil, fmt.Errorf("at least one file is required")
	}

	savedFiles := make([]string, 0, len(files))
	for _, fileHeader := range files {
		src, err := fileHeader.Open()
		if err != nil {
			return nil, err
		}

		func() {
			defer src.Close()
			fileName := sanitizeUploadFilename(fileHeader.Filename)
			if fileName == "" {
				err = fmt.Errorf("invalid upload filename")
				return
			}

			destPath, uniqueName, pathErr := uniqueDestinationPath(targetDir, fileName)
			if pathErr != nil {
				err = pathErr
				return
			}

			dst, createErr := os.Create(destPath)
			if createErr != nil {
				err = createErr
				return
			}
			defer dst.Close()

			if _, copyErr := io.Copy(dst, src); copyErr != nil {
				err = copyErr
				return
			}

			_ = os.Chmod(destPath, 0o644)
			savedFiles = append(savedFiles, uniqueName)
		}()

		if err != nil {
			return nil, err
		}
	}

	return savedFiles, nil
}

func removeMediaFile(filePath string) error {
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func moveMediaFile(sourcePath string, destinationPath string) error {
	if err := os.Rename(sourcePath, destinationPath); err == nil {
		return nil
	}

	src, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(destinationPath)
	if err != nil {
		return err
	}

	_, copyErr := io.Copy(dst, src)
	closeErr := dst.Close()
	if copyErr != nil {
		_ = os.Remove(destinationPath)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(destinationPath)
		return closeErr
	}

	if err := os.Remove(sourcePath); err != nil {
		_ = os.Remove(destinationPath)
		return err
	}

	return nil
}

func activityGalleryHealthMediaRows(db *gorm.DB, albumIDs []int) ([]activityGalleryHealthMediaRow, error) {
	if len(albumIDs) == 0 {
		return []activityGalleryHealthMediaRow{}, nil
	}

	var rows []activityGalleryHealthMediaRow
	err := db.Raw(`
		SELECT
			media.id,
			media.title,
			media.path,
			media.album_id,
			albums.title AS album_title,
			albums.path AS album_path,
			media.type,
			COALESCE(original.file_size, highres.file_size, thumbnail.file_size, 0) AS file_size,
			COALESCE(NULLIF(highres.width, 0), NULLIF(original.width, 0), NULLIF(thumbnail.width, 0), 0) AS width,
			COALESCE(NULLIF(highres.height, 0), NULLIF(original.height, 0), NULLIF(thumbnail.height, 0), 0) AS height
		FROM media
		JOIN albums ON albums.id = media.album_id
		LEFT JOIN media_urls original ON original.media_id = media.id AND original.purpose = ?
		LEFT JOIN media_urls highres ON highres.media_id = media.id AND highres.purpose = ?
		LEFT JOIN media_urls thumbnail ON thumbnail.media_id = media.id AND thumbnail.purpose IN (?, ?)
		WHERE media.album_id IN ?
		ORDER BY albums.path ASC, media.title ASC
	`, models.MediaOriginal, models.PhotoHighRes, models.PhotoThumbnail, models.VideoThumbnail, albumIDs).Scan(&rows).Error

	return rows, err
}

func mediaNoticeFromHealthRow(row activityGalleryHealthMediaRow) activityGalleryMediaNotice {
	return activityGalleryMediaNotice{
		ID:         row.ID,
		Title:      row.Title,
		AlbumID:    row.AlbumID,
		AlbumTitle: row.AlbumTitle,
		AlbumPath:  row.AlbumPath,
		Path:       row.Path,
		FileSize:   row.FileSize,
		Width:      row.Width,
		Height:     row.Height,
	}
}

func duplicateKey(media activityGalleryMediaNotice) string {
	title := strings.ToLower(strings.TrimSpace(media.Title))
	return fmt.Sprintf("%d:%s", media.FileSize, title)
}

func mediaQualityWarningReason(row activityGalleryHealthMediaRow, media activityGalleryMediaNotice) string {
	if row.Type != string(models.MediaTypePhoto) {
		return ""
	}
	if media.Width == 0 || media.Height == 0 {
		return "ยังไม่มีข้อมูลขนาดรูป"
	}
	if media.Width*media.Height < 1000000 {
		return "ความละเอียดต่ำ"
	}
	if media.FileSize > 0 && media.FileSize < 150*1024 {
		return "ไฟล์มีขนาดเล็กผิดปกติ"
	}
	return ""
}

func directorySize(rootPath string) int64 {
	var total int64
	_ = filepath.WalkDir(rootPath, func(currentPath string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		info, infoErr := entry.Info()
		if infoErr != nil {
			return nil
		}
		total += info.Size()
		return nil
	})
	return total
}

func percentOf(value int64, total int64) float64 {
	if total <= 0 {
		return 0
	}
	return float64(value) / float64(total) * 100
}

func writeJSON(w http.ResponseWriter, statusCode int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, map[string]interface{}{
		"success": false,
		"message": message,
	})
}
