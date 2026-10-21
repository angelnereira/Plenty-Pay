// Package client tiene los clientes gRPC de identity hacia otros contenedores
// (go-standards.md seccion 2). Hoy: el reporte de eventos de abuso a `security`.
package client

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"

	pb "plentypay/identity/internal/pb"
)

// SecurityReporter reporta eventos de abuso a `security` (R8: reuso de refresh).
// Implementa service.SecurityReporter.
type SecurityReporter struct {
	conn   *grpc.ClientConn
	client pb.SecurityClient
}

// NewSecurityReporter conecta con el servicio security. insecure=false exige TLS.
func NewSecurityReporter(addr string, insecureTransport bool) (*SecurityReporter, error) {
	var creds credentials.TransportCredentials
	if insecureTransport {
		creds = insecure.NewCredentials()
	} else {
		creds = credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS13})
	}
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(creds))
	if err != nil {
		return nil, fmt.Errorf("dial security: %w", err)
	}
	return &SecurityReporter{conn: conn, client: pb.NewSecurityClient(conn)}, nil
}

// Close cierra la conexion (apagado ordenado).
func (r *SecurityReporter) Close() error { return r.conn.Close() }

// ReportLoginFailed reporta LOGIN_FAILED a `security` (F05.5: 20 fallos por IP
// en 10 min bloquean la IP). El subject vacio indica correo inexistente.
func (r *SecurityReporter) ReportLoginFailed(ctx context.Context, userID, ip string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	subject := userID
	if subject == "" {
		subject = "unknown"
	}
	_, err := r.client.ReportSecurityEvent(ctx, &pb.ReportSecurityEventRequest{
		Kind:           "LOGIN_FAILED",
		Subject:        subject,
		IpAddress:      ip,
		IdempotencyKey: fmt.Sprintf("login-failed:%s:%s:%d", subject, ip, time.Now().Unix()),
	})
	if err != nil {
		return fmt.Errorf("report login failed: %w", err)
	}
	return nil
}

// ReportTokenReuse reporta TOKEN_REUSE (SPEC de security R5: bloquea la cuenta).
// La idempotency_key evita que un reintento sume dos eventos al umbral.
func (r *SecurityReporter) ReportTokenReuse(ctx context.Context, userID, ip string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, err := r.client.ReportSecurityEvent(ctx, &pb.ReportSecurityEventRequest{
		Kind:           "TOKEN_REUSE",
		Subject:        userID,
		IpAddress:      ip,
		IdempotencyKey: fmt.Sprintf("token-reuse:%s:%d", userID, time.Now().Unix()),
	})
	if err != nil {
		return fmt.Errorf("report token reuse: %w", err)
	}
	return nil
}

// ReportSecurityEvent reporta un evento de la confirmación fuerte (STEP_UP_FAILED, PIN_LOCKED,
// PASSKEY_COUNTER_REGRESSION; ADR 0020). Implementa service.SecurityEventReporter.
func (r *SecurityReporter) ReportSecurityEvent(ctx context.Context, kind, userID string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, err := r.client.ReportSecurityEvent(ctx, &pb.ReportSecurityEventRequest{
		Kind:           kind,
		Subject:        userID,
		IdempotencyKey: fmt.Sprintf("%s:%s:%d", kind, userID, time.Now().UnixNano()),
	})
	if err != nil {
		return fmt.Errorf("report %s: %w", kind, err)
	}
	return nil
}
