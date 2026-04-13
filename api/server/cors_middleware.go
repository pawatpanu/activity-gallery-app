package server

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/photoview/photoview/api/utils"
)

func CORSMiddleware(devMode bool) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {

			corsEnabled := devMode

			if devMode {
				// Development environment
				w.Header().Set("Access-Control-Allow-Origin", req.Header.Get("origin"))
				w.Header().Set("Vary", "Origin")
			} else {
				if origin := req.Header.Get("origin"); utils.IsUIOriginAllowed(origin) {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					corsEnabled = true
				}
			}

			w = handleCORS(corsEnabled, w)

			if req.Method != http.MethodOptions {
				next.ServeHTTP(w, req)
			} else {
				w.WriteHeader(200)
			}
		})
	}
}

func handleCORS(corsEnabled bool, w http.ResponseWriter) http.ResponseWriter {
	if corsEnabled {
		methods := []string{http.MethodGet, http.MethodPost, http.MethodOptions}
		requestHeaders := []string{"authorization", "content-type", "content-length", "TokenPassword"}
		responseHeaders := []string{"content-length"}

		w.Header().Set("Access-Control-Allow-Methods", strings.Join(methods, ", "))
		w.Header().Set("Access-Control-Allow-Headers", strings.Join(requestHeaders, ", "))
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Expose-Headers", strings.Join(responseHeaders, ", "))
	}
	return w
}
