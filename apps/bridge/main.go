// Package main implements the local print bridge.
//
// The bridge is a thin WebSocket/HTTP proxy that, in production, will accept
// ESC/POS payloads (Base64-encoded) from the PWA and forward the raw bytes to
// USB/Ethernet thermal printers. This is the scaffolding only: the wire
// protocol (job types, queue routing, error vocabulary) will be specified in
// the dedicated ESC/POS document — here we expose just the message envelope so
// the rest of the stack has a stable contract to develop against.
//
// WebSocket library: github.com/coder/websocket — MIT-licensed, stdlib-only
// dependency tree, successor to nhooyr.io/websocket; chosen over gorilla for a
// smaller surface area and no transitive deps.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/coder/websocket"
)

const (
	defaultAddr = "127.0.0.1:9100"
	serviceName = "bridge"
	version     = "0.0.0"
)

// printJobRequest is the minimal envelope accepted by GET /ws. The payload is
// not decoded or dispatched at this stage — only acknowledged.
type printJobRequest struct {
	JobID      string `json:"jobId"`
	PayloadB64 string `json:"payloadB64"`
}

// printJobResponse is the ack returned for each accepted envelope.
type printJobResponse struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
}

type healthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	srv := newServer(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("bridge listening", "addr", srv.Addr, "service", serviceName, "version", version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server terminated", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
	}
}

// newServer wires the HTTP handlers used in production and tests.
func newServer(logger *slog.Logger) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /ws", handleWS(logger))

	return &http.Server{
		Addr:              defaultAddr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(healthResponse{
		Status:  "ok",
		Service: serviceName,
		Version: version,
	})
}

func handleWS(logger *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Loopback-only by design: the bridge runs on 127.0.0.1:9100 and is
		// reached from the PWA on the same machine. No CORS / origin allow-list
		// is enforced at the scaffold stage; that policy belongs to the ESC/POS
		// protocol doc.
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			InsecureSkipVerify: true,
		})
		if err != nil {
			logger.Error("ws accept failed", "err", err)
			return
		}
		defer conn.CloseNow()

		remote := remoteAddr(r)
		logger.Info("ws connected", "remote", remote)

		ctx := r.Context()
		for {
			var req printJobRequest
			if err := readJSON(ctx, conn, &req); err != nil {
				if isNormalClose(err) {
					logger.Info("ws closed", "remote", remote)
				} else {
					logger.Warn("ws read failed", "remote", remote, "err", err)
				}
				_ = conn.Close(websocket.StatusNormalClosure, "")
				return
			}

			logger.Info("ws job received", "jobId", req.JobID, "payloadBytes", len(req.PayloadB64))

			resp := printJobResponse{JobID: req.JobID, Status: "received"}
			if err := writeJSON(ctx, conn, resp); err != nil {
				logger.Warn("ws write failed", "remote", remote, "err", err)
				_ = conn.Close(websocket.StatusInternalError, "write failed")
				return
			}
		}
	}
}

// readJSON reads one JSON-encoded text message from the connection.
func readJSON(ctx context.Context, conn *websocket.Conn, v any) error {
	_, data, err := conn.Read(ctx)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// writeJSON sends one JSON-encoded text message on the connection.
func writeJSON(ctx context.Context, conn *websocket.Conn, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, data)
}

func isNormalClose(err error) bool {
	status := websocket.CloseStatus(err)
	return status == websocket.StatusNormalClosure || status == websocket.StatusGoingAway
}

func remoteAddr(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
