// Package client habla con otros contenedores por gRPC (grpc-conventions.md §5): identity (datos
// legales del emisor y step-up), security (credenciales del PAC) e infra-management (tasas legales).
package client

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"plentypay/fiscal-invoicing/internal/pb"
)

// Producer es el nombre con que fiscal-invoicing se identifica ante otros servicios.
const Producer = "fiscal-invoicing"

// ErrUnavailable: la dependencia no respondió; la operación no se completa a medias.
var ErrUnavailable = errors.New("dependency unavailable")

// ErrTenantNotFound: identity no conoce el negocio.
var ErrTenantNotFound = errors.New("tenant not found")

func dial(addr string) (*grpc.ClientConn, error) {
	return grpc.NewClient("passthrough:///"+addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{Backoff: backoff.Config{
			BaseDelay: 200 * time.Millisecond, Multiplier: 1.6, Jitter: 0.2, MaxDelay: 5 * time.Second,
		}, MinConnectTimeout: 2 * time.Second}))
}

func outgoing(ctx context.Context, requestID string, timeout time.Duration) (context.Context, context.CancelFunc) {
	ctx = metadata.AppendToOutgoingContext(ctx, "x-pp-actor-service", Producer, "x-pp-request-id", requestID)
	return context.WithTimeout(ctx, timeout)
}

// ── identity ─────────────────────────────────────────────────────────────────────────────

// Identity lee los datos legales del negocio y consume tokens de step-up.
type Identity struct {
	conn    *grpc.ClientConn
	api     pb.IdentityClient
	timeout time.Duration
}

// NewIdentity abre la conexión.
func NewIdentity(addr string, timeout time.Duration) (*Identity, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial identity: %w", err)
	}
	return &Identity{conn: conn, api: pb.NewIdentityClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Identity) Close() error { return c.conn.Close() }

// TenantLegal son los datos del alta del negocio que van en el documento.
type TenantLegal struct {
	LegalName string
	TaxID     string
	DV        string
}

// TenantLegal devuelve razón social, RUC y DV del negocio.
func (c *Identity) TenantLegal(ctx context.Context, requestID, tenantID string) (TenantLegal, error) {
	ctx, cancel := outgoing(ctx, requestID, c.timeout)
	defer cancel()
	t, err := c.api.GetTenant(ctx, &pb.GetTenantRequest{TenantId: tenantID})
	switch status.Code(err) {
	case codes.OK:
		return TenantLegal{LegalName: t.GetLegalName(), TaxID: t.GetTaxId(), DV: t.GetDv()}, nil
	case codes.NotFound:
		return TenantLegal{}, ErrTenantNotFound
	}
	return TenantLegal{}, fmt.Errorf("%w: identity GetTenant: %v", ErrUnavailable, err)
}

// ConsumeStepUp consume el token ligado a usuario y operación (identity R15). Devuelve "" si fue
// válido o el motivo del rechazo.
func (c *Identity) ConsumeStepUp(ctx context.Context, requestID, token, userID, operation string) (string, error) {
	ctx, cancel := outgoing(ctx, requestID, c.timeout)
	defer cancel()
	r, err := c.api.ConsumeStepUp(ctx, &pb.ConsumeStepUpRequest{Token: token, UserId: userID, Operation: operation})
	if err != nil {
		return "", fmt.Errorf("%w: identity ConsumeStepUp: %v", ErrUnavailable, err)
	}
	if r.GetValid() {
		return "", nil
	}
	return r.GetReason(), nil
}

// ── security ─────────────────────────────────────────────────────────────────────────────

// Security guarda las credenciales del PAC: este servicio solo conoce su nombre (SPEC §10).
type Security struct {
	conn    *grpc.ClientConn
	api     pb.SecurityClient
	timeout time.Duration
}

// NewSecurity abre la conexión.
func NewSecurity(addr string, timeout time.Duration) (*Security, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial security: %w", err)
	}
	return &Security{conn: conn, api: pb.NewSecurityClient(conn), timeout: timeout}, nil
}

// Close cierra la conexión.
func (c *Security) Close() error { return c.conn.Close() }

// PutSecret guarda el valor y devuelve su versión. El valor nunca se registra.
func (c *Security) PutSecret(ctx context.Context, requestID, name string, value []byte, idempotencyKey string) (string, error) {
	ctx, cancel := outgoing(ctx, requestID, c.timeout)
	defer cancel()
	md, err := c.api.PutSecret(ctx, &pb.PutSecretRequest{Name: name, Value: value, AllowedReaders: []string{Producer},
		Labels: map[string]string{"owner": Producer, "kind": "pac_credentials"}, IdempotencyKey: idempotencyKey})
	if err != nil {
		return "", fmt.Errorf("%w: security PutSecret: %v", ErrUnavailable, err)
	}
	return md.GetVersion(), nil
}

// ── infra-management ─────────────────────────────────────────────────────────────────────

// ITBMSKeys son los parámetros legales con las tasas válidas (regulatory-framework §13).
var ITBMSKeys = []string{"legal.pa.itbms.standard_bps", "legal.pa.itbms.alcohol_bps", "legal.pa.itbms.tobacco_bps"}

const ratesTTL = 60 * time.Second

// Rates son las tasas vigentes y la versión con que se calcularon (AGENTS.md §8: queda en el documento).
type Rates struct {
	Allowed map[int64]bool
	Version string // "legal.pa.itbms.standard_bps=700@2026-10-13T00:00:00Z;…"
}

// Infra lee las tasas de ITBMS de infra-management con una caché corta.
type Infra struct {
	conn    *grpc.ClientConn
	api     pb.InfraManagementClient
	timeout time.Duration
	now     func() time.Time

	mu      sync.Mutex
	rates   Rates
	fetched time.Time
}

// NewInfra abre la conexión.
func NewInfra(addr string, timeout time.Duration, now func() time.Time) (*Infra, error) {
	conn, err := dial(addr)
	if err != nil {
		return nil, fmt.Errorf("dial infra-management: %w", err)
	}
	return &Infra{conn: conn, api: pb.NewInfraManagementClient(conn), timeout: timeout, now: now}, nil
}

// Close cierra la conexión.
func (c *Infra) Close() error { return c.conn.Close() }

// TaxRates devuelve las tasas vigentes. Sin respuesta ni caché: ErrUnavailable (no se emite).
func (c *Infra) TaxRates(ctx context.Context, requestID string) (Rates, error) {
	c.mu.Lock()
	if c.rates.Allowed != nil && c.now().Sub(c.fetched) < ratesTTL {
		r := c.rates
		c.mu.Unlock()
		return r, nil
	}
	c.mu.Unlock()

	ctx, cancel := outgoing(ctx, requestID, c.timeout)
	defer cancel()
	resp, err := c.api.GetConfig(ctx, &pb.GetConfigRequest{Keys: ITBMSKeys, Scope: "global"})
	if err != nil {
		return Rates{}, fmt.Errorf("%w: infra-management GetConfig: %v", ErrUnavailable, err)
	}
	r := Rates{Allowed: map[int64]bool{}}
	var parts []string
	for _, e := range resp.GetEntries() {
		v, err := strconv.ParseInt(e.GetValue(), 10, 64)
		if err != nil || v < 0 || v > 10000 {
			return Rates{}, fmt.Errorf("%w: %s no es un entero en bps", ErrUnavailable, e.GetKey())
		}
		r.Allowed[v] = true
		at := ""
		if e.GetUpdatedAt() != nil {
			at = e.GetUpdatedAt().AsTime().UTC().Format(time.RFC3339)
		}
		parts = append(parts, fmt.Sprintf("%s=%d@%s", e.GetKey(), v, at))
	}
	if len(parts) == 0 {
		return Rates{}, fmt.Errorf("%w: sin parámetros legal.pa.itbms", ErrUnavailable)
	}
	sort.Strings(parts)
	r.Version = strings.Join(parts, ";")
	c.mu.Lock()
	c.rates, c.fetched = r, c.now()
	c.mu.Unlock()
	return r, nil
}
