package utils

import "testing"

func TestUiEndpointUrlsUnset(t *testing.T) {
	t.Setenv(EnvServeUI.GetName(), "0")
	t.Setenv(EnvUIEndpoint.GetName(), "")
	t.Setenv(EnvUIEndpoints.GetName(), "")

	if got := UiEndpointUrls(); got != nil {
		t.Fatalf("expected nil UI endpoints when unset, got %v", got)
	}
}

func TestUiEndpointUrlsSupportsSingularAndPlural(t *testing.T) {
	t.Setenv(EnvServeUI.GetName(), "0")
	t.Setenv(EnvUIEndpoint.GetName(), "")
	t.Setenv(EnvUIEndpoints.GetName(), "https://gallery.example.com/app, https://photos.example.net")

	got := UiEndpointUrls()
	if len(got) != 2 {
		t.Fatalf("expected 2 UI endpoints, got %d", len(got))
	}
	if got[0].String() != "https://gallery.example.com/app" {
		t.Fatalf("unexpected first UI endpoint: %s", got[0].String())
	}
	if got[1].String() != "https://photos.example.net" {
		t.Fatalf("unexpected second UI endpoint: %s", got[1].String())
	}

	t.Setenv(EnvUIEndpoints.GetName(), "")
	t.Setenv(EnvUIEndpoint.GetName(), "https://legacy.example.com")

	got = UiEndpointUrls()
	if len(got) != 1 || got[0].String() != "https://legacy.example.com" {
		t.Fatalf("unexpected legacy UI endpoint parsing result: %v", got)
	}
}

func TestIsUIOriginAllowed(t *testing.T) {
	t.Setenv(EnvServeUI.GetName(), "0")
	t.Setenv(EnvUIEndpoints.GetName(), "https://gallery.example.com/app,https://photos.example.net")

	if !IsUIOriginAllowed("https://gallery.example.com") {
		t.Fatal("expected gallery.example.com origin to be allowed")
	}
	if !IsUIOriginAllowed("https://photos.example.net") {
		t.Fatal("expected photos.example.net origin to be allowed")
	}
	if IsUIOriginAllowed("https://evil.example.com") {
		t.Fatal("expected evil.example.com origin to be rejected")
	}
}
