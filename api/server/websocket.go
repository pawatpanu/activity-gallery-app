package server

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/photoview/photoview/api/utils"
)

func WebsocketUpgrader(devMode bool) websocket.Upgrader {
	return websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			if devMode {
				return true
			}

			origin := r.Header.Get("origin")
			if origin == "" {
				return true
			}

			if utils.IsUIOriginAllowed(origin) {
				return true
			}

			log.Printf("Not allowing websocket request from %s because it doesn't match %s/%s",
				origin, utils.EnvUIEndpoints.GetName(), utils.EnvUIEndpoint.GetName())
			return false
		},
	}
}
