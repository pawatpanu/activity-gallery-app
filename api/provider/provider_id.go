package provider

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/photoview/photoview/api/utils"
)

type ProviderIDConfig struct {
	Enabled                  bool
	AutoProvision            bool
	HealthIDBaseURL          string
	HealthIDClientID         string
	HealthIDClientSecret     string
	HealthIDRedirectURI      string
	HealthIDScope            string
	HealthIDRedirectEndpoint string
	HealthIDTokenEndpoint    string
	ProviderBaseURL          string
	ProviderClientID         string
	ProviderSecretKey        string
	ProviderTokenEndpoint    string
	ProviderProfileEndpoint  string
}

type ProviderProfile struct {
	ProviderID   string
	NameTH       string
	NameEN       string
	Email        string
	Raw          map[string]any
	Organizations []map[string]any
}

func LoadProviderIDConfig() (*ProviderIDConfig, error) {
	cfg := &ProviderIDConfig{
		Enabled:                  utils.ProviderAuthEnabled(),
		AutoProvision:            true,
		HealthIDBaseURL:          valueOrDefault(utils.EnvProviderHealthIDBaseURL.GetValue(), "https://moph.id.th"),
		HealthIDClientID:         strings.TrimSpace(utils.EnvProviderHealthIDClientID.GetValue()),
		HealthIDClientSecret:     strings.TrimSpace(utils.EnvProviderHealthIDClientSecret.GetValue()),
		HealthIDRedirectURI:      strings.TrimSpace(utils.EnvProviderHealthIDRedirectURI.GetValue()),
		HealthIDScope:            valueOrDefault(utils.EnvProviderHealthIDScope.GetValue(), "openid profile"),
		HealthIDRedirectEndpoint: valueOrDefault(utils.EnvProviderHealthIDRedirectPath.GetValue(), "/oauth/redirect"),
		HealthIDTokenEndpoint:    valueOrDefault(utils.EnvProviderHealthIDTokenPath.GetValue(), "/api/v1/token"),
		ProviderBaseURL:          valueOrDefault(utils.EnvProviderBaseURL.GetValue(), "https://provider.id.th"),
		ProviderClientID:         strings.TrimSpace(utils.EnvProviderClientID.GetValue()),
		ProviderSecretKey:        strings.TrimSpace(utils.EnvProviderSecretKey.GetValue()),
		ProviderTokenEndpoint:    valueOrDefault(utils.EnvProviderTokenPath.GetValue(), "/api/v1/services/token"),
		ProviderProfileEndpoint:  valueOrDefault(utils.EnvProviderProfilePath.GetValue(), "/api/v1/services/profile"),
	}

	if value := strings.TrimSpace(utils.EnvProviderAutoProvision.GetValue()); value != "" {
		cfg.AutoProvision = strings.EqualFold(value, "1") || strings.EqualFold(value, "true")
	}

	if !cfg.Enabled {
		return cfg, nil
	}

	if cfg.HealthIDClientID == "" || cfg.HealthIDClientSecret == "" || cfg.HealthIDRedirectURI == "" ||
		cfg.ProviderClientID == "" || cfg.ProviderSecretKey == "" {
		return nil, fmt.Errorf("provider auth is enabled but required environment variables are missing")
	}

	return cfg, nil
}

func GenerateState() (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

func (cfg *ProviderIDConfig) GenerateAuthURL(state string) string {
	params := url.Values{}
	params.Set("client_id", cfg.HealthIDClientID)
	params.Set("redirect_uri", cfg.HealthIDRedirectURI)
	params.Set("response_type", "code")
	params.Set("state", state)
	params.Set("scope", cfg.HealthIDScope)

	return strings.TrimRight(cfg.HealthIDBaseURL, "/") + cfg.HealthIDRedirectEndpoint + "?" + params.Encode()
}

func (cfg *ProviderIDConfig) ExchangeCodeForHealthToken(code string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", cfg.HealthIDRedirectURI)
	form.Set("client_id", cfg.HealthIDClientID)
	form.Set("client_secret", cfg.HealthIDClientSecret)

	body, err := doJSONRequest(http.MethodPost,
		strings.TrimRight(cfg.HealthIDBaseURL, "/")+cfg.HealthIDTokenEndpoint,
		strings.NewReader(form.Encode()),
		map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept":       "application/json",
		},
	)
	if err != nil {
		return "", err
	}

	payload := unwrapData(body)
	accessToken, _ := payload["access_token"].(string)
	if accessToken == "" {
		return "", fmt.Errorf("health id did not return an access token")
	}

	return accessToken, nil
}

func (cfg *ProviderIDConfig) ExchangeHealthTokenForProviderToken(healthToken string) (string, error) {
	requestBody, err := json.Marshal(map[string]string{
		"client_id":  cfg.ProviderClientID,
		"secret_key": cfg.ProviderSecretKey,
		"token_by":   "Health ID",
		"token":      healthToken,
	})
	if err != nil {
		return "", err
	}

	body, err := doJSONRequest(http.MethodPost,
		strings.TrimRight(cfg.ProviderBaseURL, "/")+cfg.ProviderTokenEndpoint,
		bytes.NewReader(requestBody),
		map[string]string{
			"Content-Type": "application/json",
			"Accept":       "application/json",
		},
	)
	if err != nil {
		return "", err
	}

	payload := unwrapData(body)
	accessToken, _ := payload["access_token"].(string)
	if accessToken == "" {
		return "", fmt.Errorf("provider id did not return an access token")
	}

	return accessToken, nil
}

func (cfg *ProviderIDConfig) FetchProfile(providerToken string) (*ProviderProfile, error) {
	query := url.Values{}
	query.Set("moph_center_token", "1")
	query.Set("moph_idp_permission", "1")
	query.Set("position_type", "1")

	body, err := doJSONRequest(http.MethodGet,
		strings.TrimRight(cfg.ProviderBaseURL, "/")+cfg.ProviderProfileEndpoint+"?"+query.Encode(),
		nil,
		map[string]string{
			"Authorization": "Bearer " + providerToken,
			"client-id":     cfg.ProviderClientID,
			"secret-key":    cfg.ProviderSecretKey,
			"Accept":        "application/json",
		},
	)
	if err != nil {
		return nil, err
	}

	payload := unwrapData(body)
	providerID := getString(payload, "provider_id")
	if providerID == "" {
		providerID = getString(payload, "account_id")
	}
	if providerID == "" {
		return nil, fmt.Errorf("provider profile did not include provider_id")
	}

	profile := &ProviderProfile{
		ProviderID: providerID,
		NameTH:     pickString(payload, "name_th", "fullname", "full_name"),
		NameEN:     getString(payload, "name_eng"),
		Email:      pickString(payload, "email"),
		Raw:        payload,
	}

	if orgs, ok := payload["organizations"].([]any); ok {
		profile.Organizations = convertOrganizations(orgs)
	} else if orgs, ok := payload["org"].([]any); ok {
		profile.Organizations = convertOrganizations(orgs)
	}

	return profile, nil
}

func convertOrganizations(items []any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if m, ok := item.(map[string]any); ok {
			result = append(result, m)
		}
	}
	return result
}

func pickString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := getString(values, key); strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func getString(values map[string]any, key string) string {
	if value, ok := values[key].(string); ok {
		return value
	}
	if data, ok := values["data"].(map[string]any); ok {
		if value, ok := data[key].(string); ok {
			return value
		}
	}
	return ""
}

func unwrapData(values map[string]any) map[string]any {
	if data, ok := values["data"].(map[string]any); ok {
		return data
	}
	return values
}

func doJSONRequest(method string, targetURL string, body io.Reader, headers map[string]string) (map[string]any, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(method, targetURL, body)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var decoded map[string]any
	if err := json.Unmarshal(respBody, &decoded); err != nil {
		return nil, fmt.Errorf("decode response from %s: %w", targetURL, err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("request to %s failed with status %d", targetURL, resp.StatusCode)
	}
	if errMessage := pickString(decoded, "error", "message", "error_description"); errMessage != "" &&
		!strings.EqualFold(getString(decoded, "status"), "success") &&
		getString(decoded, "access_token") == "" {
		return nil, fmt.Errorf(errMessage)
	}

	return decoded, nil
}

func valueOrDefault(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
