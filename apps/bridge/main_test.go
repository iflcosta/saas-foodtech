package main

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	srv := newServer(logger)
	ts := httptest.NewServer(srv.Handler)
	t.Cleanup(ts.Close)
	return ts
}

func TestHealthEndpoint(t *testing.T) {
	ts := newTestServer(t)

	res, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}

	var body healthResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if body.Status != "ok" || body.Service != serviceName || body.Version != version {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestWebSocketRoundTrip(t *testing.T) {
	ts := newTestServer(t)

	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws"

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("dial ws: %v", err)
	}
	defer conn.CloseNow()

	req := printJobRequest{
		JobID:      "11111111-1111-4111-8111-111111111111",
		PayloadB64: "QUJD", // "ABC", not decoded by the bridge
	}
	if err := writeJSON(ctx, conn, req); err != nil {
		t.Fatalf("write req: %v", err)
	}

	var resp printJobResponse
	if err := readJSON(ctx, conn, &resp); err != nil {
		t.Fatalf("read resp: %v", err)
	}

	if resp.JobID != req.JobID {
		t.Fatalf("jobId echo mismatch: got %q, want %q", resp.JobID, req.JobID)
	}
	if resp.Status != "received" {
		t.Fatalf("status = %q, want %q", resp.Status, "received")
	}

	if err := conn.Close(websocket.StatusNormalClosure, ""); err != nil {
		t.Fatalf("close: %v", err)
	}
}
