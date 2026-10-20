// Package client habla con otros contenedores por gRPC (grpc-conventions.md §5).
package client

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	"plentypay/catalog/internal/domain"
	"plentypay/catalog/internal/pb"
)

// ErrUnavailable: infra-management no respondió; la operación no puede validar el impuesto.
var ErrUnavailable = errors.New("infra-management unavailable")

// ITBMSKeys son los parámetros legales que definen las tasas válidas (regulatory-framework §13).
var ITBMSKeys = []string{"legal.pa.itbms.standard_bps", "legal.pa.itbms.alcohol_bps", "legal.pa.itbms.tobacco_bps"}

const ratesTTL = 60 * time.Second

// Infra lee parámetros de infra-management con caché.
type Infra struct {
	conn    *grpc.ClientConn
	api     pb.InfraManagementClient
	timeout time.Duration
	now     func() time.Time

	mu      sync.Mutex
	rates   domain.TaxRates
	named   []NamedRate
	fetched time.Time
}

// NamedRate es una tasa legal con su clase (STANDARD, ALCOHOL, TOBACCO).
type NamedRate struct {
	Kind    string
	RateBps int32
}

// NewInfra abre una conexión que se reconecta sola (passthrough + backoff acotado).
func NewInfra(addr string, timeout time.Duration, now func() time.Time) (*Infra, error) {
	conn, err := grpc.NewClient("passthrough:///"+addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithConnectParams(grpc.ConnectParams{Backoff: backoff.Config{
			BaseDelay: 200 * time.Millisecond, Multiplier: 1.6, Jitter: 0.2, MaxDelay: 5 * time.Second,
		}, MinConnectTimeout: 2 * time.Second}))
	if err != nil {
		return nil, fmt.Errorf("dial infra-management: %w", err)
	}
	return &Infra{conn: conn, api: pb.NewInfraManagementClient(conn), timeout: timeout, now: now}, nil
}

// Close cierra la conexión.
func (c *Infra) Close() error { return c.conn.Close() }

// TaxRates devuelve {0} ∪ tasas vigentes de ITBMS. Sin respuesta y sin caché: ErrUnavailable.
func (c *Infra) TaxRates(ctx context.Context, requestID string) (domain.TaxRates, error) {
	rates, _, err := c.load(ctx, requestID)
	return rates, err
}

// NamedTaxRates devuelve las tasas con su clase, en el orden de ITBMSKeys.
func (c *Infra) NamedTaxRates(ctx context.Context, requestID string) ([]NamedRate, error) {
	_, named, err := c.load(ctx, requestID)
	return named, err
}

func (c *Infra) load(ctx context.Context, requestID string) (domain.TaxRates, []NamedRate, error) {
	c.mu.Lock()
	if c.rates != nil && c.now().Sub(c.fetched) < ratesTTL {
		r, n := c.rates, c.named
		c.mu.Unlock()
		return r, n, nil
	}
	c.mu.Unlock()

	ctx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()
	ctx = metadata.AppendToOutgoingContext(ctx, "x-pp-request-id", requestID, "x-pp-actor-service", "catalog")
	resp, err := c.api.GetConfig(ctx, &pb.GetConfigRequest{Keys: ITBMSKeys, Scope: "global"})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	byKey := map[string]int32{}
	for _, e := range resp.GetEntries() {
		v, err := strconv.ParseInt(e.GetValue(), 10, 32)
		if err != nil || v < 0 || v > 10000 {
			return nil, nil, fmt.Errorf("%w: %s no es un entero en bps", ErrUnavailable, e.GetKey())
		}
		byKey[e.GetKey()] = int32(v)
	}
	rates := domain.TaxRates{0: true}
	var named []NamedRate
	for _, k := range ITBMSKeys {
		v, ok := byKey[k]
		if !ok {
			continue
		}
		rates[v] = true
		kind := strings.ToUpper(strings.TrimSuffix(strings.TrimPrefix(k, "legal.pa.itbms."), "_bps"))
		named = append(named, NamedRate{Kind: kind, RateBps: v})
	}
	if len(named) == 0 {
		return nil, nil, fmt.Errorf("%w: sin parámetros legal.pa.itbms", ErrUnavailable)
	}
	c.mu.Lock()
	c.rates, c.named, c.fetched = rates, named, c.now()
	c.mu.Unlock()
	return rates, named, nil
}
