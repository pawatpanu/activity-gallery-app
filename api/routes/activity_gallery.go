package routes

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
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
	Title string `json:"title"`
	Path  string `json:"path"`
}

type activityGalleryConfigResponse struct {
	Roots []activityGalleryRoot `json:"roots"`
}

type createAlbumRequest struct {
	RootPath   string `json:"rootPath"`
	ParentPath string `json:"parentPath"`
	AlbumName  string `json:"albumName"`
}

type createAlbumResponse struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	RelativePath string `json:"relativePath"`
	RootPath     string `json:"rootPath,omitempty"`
}

type uploadMediaResponse struct {
	Success      bool     `json:"success"`
	Message      string   `json:"message"`
	RelativePath string   `json:"relativePath"`
	Files        []string `json:"files"`
}

func RegisterActivityGalleryRoutes(db *gorm.DB, router *mux.Router) {
	router.HandleFunc("/config", activityGalleryConfigHandler(db)).Methods(http.MethodGet)
	router.HandleFunc("/albums", createAlbumHandler(db)).Methods(http.MethodPost)
	router.HandleFunc("/albums/{id}/children", createChildAlbumHandler(db)).Methods(http.MethodPost)
	router.HandleFunc("/albums/{id}/upload", uploadAlbumMediaHandler(db)).Methods(http.MethodPost)
	router.HandleFunc("/albums/{id}", deleteAlbumHandler(db)).Methods(http.MethodDelete)
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
			resp.Roots = append(resp.Roots, activityGalleryRoot{
				Title: root.Title,
				Path:  root.Path,
			})
		}

		writeJSON(w, http.StatusOK, resp)
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

		relativeParentPath, err := normalizeRelativePath(req.ParentPath)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}

		albumName := strings.TrimSpace(req.AlbumName)
		if albumName == "" {
			writeJSONError(w, http.StatusBadRequest, "album name is required")
			return
		}
		if strings.Contains(albumName, "/") || strings.Contains(albumName, "\\") || albumName == "." || albumName == ".." {
			writeJSONError(w, http.StatusBadRequest, "album name must not contain path separators")
			return
		}

		targetDir, relativeAlbumPath, err := resolveAuthorizedChildPath(rootPath, relativeParentPath, albumName)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
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

		albumName := strings.TrimSpace(req.AlbumName)
		if albumName == "" {
			writeJSONError(w, http.StatusBadRequest, "album name is required")
			return
		}
		if strings.Contains(albumName, "/") || strings.Contains(albumName, "\\") || albumName == "." || albumName == ".." {
			writeJSONError(w, http.StatusBadRequest, "album name must not contain path separators")
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
