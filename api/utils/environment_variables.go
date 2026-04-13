package utils

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/photoview/photoview/api/log"
)

// EnvironmentVariable represents the name of an environment variable used to configure Photoview
type EnvironmentVariable string

// General options
const (
	EnvDevelopmentMode           EnvironmentVariable = "PHOTOVIEW_DEVELOPMENT_MODE"
	EnvServeUI                   EnvironmentVariable = "PHOTOVIEW_SERVE_UI"
	EnvUIPath                    EnvironmentVariable = "PHOTOVIEW_UI_PATH"
	EnvMediaCachePath            EnvironmentVariable = "PHOTOVIEW_MEDIA_CACHE"
	EnvFaceRecognitionModelsPath EnvironmentVariable = "PHOTOVIEW_FACE_RECOGNITION_MODELS_PATH"
	EnvMediaProbeTimeout         EnvironmentVariable = "PHOTOVIEW_MEDIA_PROBE_TIMEOUT"
	EnvInitialRootPath           EnvironmentVariable = "PHOTOVIEW_INITIAL_ROOT_PATH"
)

// Network related
const (
	EnvListenIP    EnvironmentVariable = "PHOTOVIEW_LISTEN_IP"
	EnvListenPort  EnvironmentVariable = "PHOTOVIEW_LISTEN_PORT"
	EnvAPIEndpoint EnvironmentVariable = "PHOTOVIEW_API_ENDPOINT"
	EnvUIEndpoint  EnvironmentVariable = "PHOTOVIEW_UI_ENDPOINT"
	EnvUIEndpoints EnvironmentVariable = "PHOTOVIEW_UI_ENDPOINTS"
)

// Database related
const (
	EnvDatabaseDriver EnvironmentVariable = "PHOTOVIEW_DATABASE_DRIVER"
	EnvMysqlURL       EnvironmentVariable = "PHOTOVIEW_MYSQL_URL"
	EnvPostgresURL    EnvironmentVariable = "PHOTOVIEW_POSTGRES_URL"
	EnvSqlitePath     EnvironmentVariable = "PHOTOVIEW_SQLITE_PATH"
)

// Provider ID / SSO related
const (
	EnvProviderAuthEnabled            EnvironmentVariable = "PHOTOVIEW_PROVIDER_AUTH_ENABLED"
	EnvProviderAutoProvision          EnvironmentVariable = "PHOTOVIEW_PROVIDER_AUTO_PROVISION"
	EnvProviderHealthIDBaseURL        EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_BASE_URL"
	EnvProviderHealthIDClientID       EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_ID"
	EnvProviderHealthIDClientSecret   EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_CLIENT_SECRET"
	EnvProviderHealthIDRedirectURI    EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_URI"
	EnvProviderHealthIDScope          EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_SCOPE"
	EnvProviderHealthIDRedirectPath   EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_REDIRECT_ENDPOINT"
	EnvProviderHealthIDTokenPath      EnvironmentVariable = "PHOTOVIEW_PROVIDER_HEALTH_ID_TOKEN_ENDPOINT"
	EnvProviderBaseURL                EnvironmentVariable = "PHOTOVIEW_PROVIDER_BASE_URL"
	EnvProviderClientID               EnvironmentVariable = "PHOTOVIEW_PROVIDER_CLIENT_ID"
	EnvProviderSecretKey              EnvironmentVariable = "PHOTOVIEW_PROVIDER_SECRET_KEY"
	EnvProviderTokenPath              EnvironmentVariable = "PHOTOVIEW_PROVIDER_TOKEN_ENDPOINT"
	EnvProviderProfilePath            EnvironmentVariable = "PHOTOVIEW_PROVIDER_PROFILE_ENDPOINT"
)

// Feature related
const (
	EnvDisableFaceRecognition    EnvironmentVariable = "PHOTOVIEW_DISABLE_FACE_RECOGNITION"
	EnvDisableVideoEncoding      EnvironmentVariable = "PHOTOVIEW_DISABLE_VIDEO_ENCODING"
	EnvDisableRawProcessing      EnvironmentVariable = "PHOTOVIEW_DISABLE_RAW_PROCESSING"
	EnvVideoHardwareAcceleration EnvironmentVariable = "PHOTOVIEW_VIDEO_HARDWARE_ACCELERATION"
)

// GetName returns the name of the environment variable itself
func (v EnvironmentVariable) GetName() string {
	return string(v)
}

// GetValue returns the value of the environment
func (v EnvironmentVariable) GetValue() string {
	return os.Getenv(string(v))
}

// GetBool returns the environment variable as a boolean (defaults to false if not defined)
func (v EnvironmentVariable) GetBool() bool {
	value := strings.ToLower(os.Getenv(string(v)))
	trueValues := []string{"1", "true"}

	for _, x := range trueValues {
		if value == x {
			return true
		}
	}

	return false
}

// ShouldServeUI whether or not the "serve ui" option is enabled
func ShouldServeUI() bool {
	return EnvServeUI.GetBool()
}

// DevelopmentMode describes whether or not the server is running in development mode,
// and should thus print debug informations and enable other features related to developing.
func DevelopmentMode() bool {
	return EnvDevelopmentMode.GetBool()
}

func ProviderAuthEnabled() bool {
	return EnvProviderAuthEnabled.GetBool()
}

// MediaProbeTimeout returns the media probing timeout duration.
// Defaults to 5 seconds if PHOTOVIEW_MEDIA_PROBE_TIMEOUT is not set or invalid.
// The value is interpreted as seconds.
func MediaProbeTimeout() time.Duration {
	if val := EnvMediaProbeTimeout.GetValue(); val != "" {
		if seconds, err := strconv.Atoi(val); err == nil && seconds > 0 {
			return time.Duration(seconds) * time.Second
		}
		log.Warn(nil, "Invalid PHOTOVIEW_MEDIA_PROBE_TIMEOUT value, using default 5s", "value", val)
	}
	return 5 * time.Second
}

// UIPath returns the value from where the static UI files are located if SERVE_UI=1
func UIPath() string {
	if path := EnvUIPath.GetValue(); path != "" {
		return path
	}

	return "./ui"
}
