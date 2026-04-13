package routes

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/photoview/photoview/api/graphql/models"
	"github.com/photoview/photoview/api/provider"
	"github.com/photoview/photoview/api/scanner"
	"github.com/photoview/photoview/api/utils"
	"gorm.io/gorm"
)

const providerStateCookieName = "photoview-provider-state"
const providerName = "provider_id"

func RegisterProviderAuthRoutes(db *gorm.DB, router *mux.Router) {
	router.HandleFunc("/provider/start", providerStartHandler(db)).Methods(http.MethodGet)
	router.HandleFunc("/provider/callback", providerCallbackHandler(db)).Methods(http.MethodGet)
}

func providerStartHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := provider.LoadProviderIDConfig()
		if err != nil || !cfg.Enabled {
			http.Error(w, "Provider ID login is not enabled", http.StatusNotFound)
			return
		}

		state, err := provider.GenerateState()
		if err != nil {
			http.Error(w, "Could not generate provider login state", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     providerStateCookieName,
			Value:    state,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   600,
		})

		http.Redirect(w, r, cfg.GenerateAuthURL(state), http.StatusFound)
	}
}

func providerCallbackHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := provider.LoadProviderIDConfig()
		if err != nil || !cfg.Enabled {
			http.Error(w, "Provider ID login is not enabled", http.StatusNotFound)
			return
		}

		if providerError := strings.TrimSpace(r.URL.Query().Get("error")); providerError != "" {
			http.Error(w, "Provider ID login failed: "+providerError, http.StatusBadRequest)
			return
		}

		code := strings.TrimSpace(r.URL.Query().Get("code"))
		state := strings.TrimSpace(r.URL.Query().Get("state"))
		if code == "" || state == "" {
			http.Error(w, "Missing provider callback parameters", http.StatusBadRequest)
			return
		}

		stateCookie, err := r.Cookie(providerStateCookieName)
		if err != nil || stateCookie.Value == "" || stateCookie.Value != state {
			http.Error(w, "Invalid or expired provider login state", http.StatusBadRequest)
			return
		}

		clearProviderStateCookie(w)

		healthToken, err := cfg.ExchangeCodeForHealthToken(code)
		if err != nil {
			http.Error(w, "Health ID token exchange failed: "+err.Error(), http.StatusBadGateway)
			return
		}

		providerToken, err := cfg.ExchangeHealthTokenForProviderToken(healthToken)
		if err != nil {
			http.Error(w, "Provider ID token exchange failed: "+err.Error(), http.StatusBadGateway)
			return
		}

		profile, err := cfg.FetchProfile(providerToken)
		if err != nil {
			http.Error(w, "Provider ID profile fetch failed: "+err.Error(), http.StatusBadGateway)
			return
		}

		user, err := findOrCreateProviderUser(db, profile, cfg.AutoProvision)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		if err := completeProviderInitialSetupIfNeeded(db, user); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		token, err := user.GenerateAccessToken(db)
		if err != nil {
			http.Error(w, "Could not create photoview session", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "auth-token",
			Value:    token.Value,
			Path:     "/",
			HttpOnly: false,
			SameSite: http.SameSiteLaxMode,
			Expires:  token.Expire,
		})

		http.Redirect(w, r, providerRedirectURL(r), http.StatusFound)
	}
}

func findOrCreateProviderUser(db *gorm.DB, profile *provider.ProviderProfile, autoProvision bool) (*models.User, error) {
	user, err := models.FindUserByAuthProvider(db, providerName, profile.ProviderID)
	if err != nil {
		return nil, err
	}
	if user != nil {
		return user, nil
	}
	if !autoProvision {
		return nil, fmt.Errorf("provider id account is not linked to a photoview user")
	}

	username := sanitizeProviderUsername(profile.ProviderID)
	user, err = models.RegisterExternalUser(db, username, providerName, profile.ProviderID, false)
	if err != nil {
		return nil, err
	}

	log.Printf("Created Photoview user from Provider ID: provider_id=%s username=%s", profile.ProviderID, user.Username)
	return user, nil
}

func sanitizeProviderUsername(providerID string) string {
	providerID = strings.TrimSpace(providerID)
	if providerID == "" {
		return "provider-user"
	}
	providerID = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= 'A' && r <= 'Z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '-' || r == '_' || r == '.':
			return r
		default:
			return -1
		}
	}, providerID)
	if providerID == "" {
		return "provider-user"
	}
	if len(providerID) > 120 {
		return providerID[:120]
	}
	return providerID
}

func completeProviderInitialSetupIfNeeded(db *gorm.DB, user *models.User) error {
	siteInfo, err := models.GetSiteInfo(db)
	if err != nil {
		return err
	}
	if !siteInfo.InitialSetup {
		return nil
	}

	rootPath := strings.TrimSpace(utils.EnvInitialRootPath.GetValue())
	if rootPath == "" {
		return fmt.Errorf("%s is required for first Provider ID login", utils.EnvInitialRootPath.GetName())
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(user).Update("admin", true).Error; err != nil {
			return err
		}
		user.Admin = true

		if _, err := scanner.NewRootAlbum(tx, rootPath, user); err != nil {
			return err
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).
			Model(&models.SiteInfo{}).
			Update("initial_setup", false).
			Error; err != nil {
			return err
		}

		return nil
	})
}

func providerRedirectURL(r *http.Request) string {
	if uiEndpoint := utils.UiEndpointUrl(); uiEndpoint != nil {
		return uiEndpoint.String()
	}
	if utils.ShouldServeUI() {
		return "/"
	}

	if referrer := r.Referer(); referrer != "" {
		return referrer
	}

	currentURL := &url.URL{
		Scheme: "http",
		Host:   r.Host,
		Path:   path.Clean("/"),
	}
	if r.TLS != nil {
		currentURL.Scheme = "https"
	}
	return currentURL.String()
}

func clearProviderStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     providerStateCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}
