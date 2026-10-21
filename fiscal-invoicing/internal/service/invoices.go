package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/protobuf/proto"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/events"
	"plentypay/fiscal-invoicing/internal/observability"
	"plentypay/fiscal-invoicing/internal/pac"
	"plentypay/fiscal-invoicing/internal/pb"
	"plentypay/fiscal-invoicing/internal/store"
)

// RatesAPI da las tasas legal.pa.itbms.* vigentes (infra-management).
type RatesAPI interface {
	TaxRates(ctx context.Context, requestID string) (client.Rates, error)
}

// InvoiceStore es lo que la emisión necesita de la persistencia.
type InvoiceStore interface {
	CreateInvoice(ctx context.Context, inv domain.Invoice) (domain.Invoice, bool, error)
	GetInvoice(ctx context.Context, tenantID, id string) (domain.Invoice, error)
	ListInvoices(ctx context.Context, tenantID string, f store.ListFilter) ([]domain.Invoice, string, error)
	ClaimDue(ctx context.Context, now time.Time, limit int, lease time.Duration) ([]domain.Invoice, error)
	MarkAccepted(ctx context.Context, id, cufe, qr string, at time.Time, ev store.OutboxEvent) error
	MarkRejected(ctx context.Context, id, reason string, at time.Time, ev store.OutboxEvent) error
	Reschedule(ctx context.Context, id string, next time.Time, lastError string, at time.Time) error
	PendingAgeSeconds(ctx context.Context, now time.Time) (float64, error)
}

// Invoicing emite documentos y los envía al PAC.
type Invoicing struct {
	*Service
	invoices InvoiceStore
	rates    RatesAPI
	pacs     map[string]pac.Client // por proveedor (R10)
	metrics  *observability.Metrics
	reporter *observability.Reporter
}

// NewInvoicing arma la emisión sobre el servicio base.
func NewInvoicing(base *Service, invoices InvoiceStore, rates RatesAPI, pacs map[string]pac.Client,
	metrics *observability.Metrics, reporter *observability.Reporter) *Invoicing {
	return &Invoicing{Service: base, invoices: invoices, rates: rates, pacs: pacs, metrics: metrics, reporter: reporter}
}

// IssueInput es la solicitud de factura (fiscal_invoicing.proto IssueInvoiceRequest).
type IssueInput struct {
	IdempotencyKey string
	RequestHash    []byte // SHA-256 del request canónico sin la clave (grpc-conventions §3)
	Customer       *domain.Taxpayer
	Lines          []domain.Line
	SourceType     string
	SourceID       string
	Currency       string
	PaymentMethods []string
}

// IssueInvoice valida, calcula (R1), numera (R2) y deja la factura en cola para el PAC (R3).
func (s *Invoicing) IssueInvoice(ctx context.Context, in IssueInput) (domain.Invoice, error) {
	a, err := actorWith(ctx, PermIssue)
	if err != nil {
		return domain.Invoice{}, err
	}
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if in.Currency == "" {
		in.Currency = "USD"
	}
	if err := domain.ValidateRequest(in.IdempotencyKey, in.SourceType, in.SourceID, in.Currency, in.PaymentMethods); err != nil {
		return domain.Invoice{}, err
	}
	if in.Customer != nil {
		c := in.Customer.Normalize()
		if err := c.Validate(); err != nil {
			return domain.Invoice{}, err
		}
		in.Customer = &c
	}
	p, err := s.store.GetProfile(ctx, a.TenantID)
	if err != nil {
		if errors.Is(err, domain.ErrProfileMissing) {
			return domain.Invoice{}, err
		}
		return domain.Invoice{}, observability.Wrap(err, "load fiscal profile")
	}
	rates, err := s.rates.TaxRates(ctx, a.RequestID)
	if err != nil {
		return domain.Invoice{}, fmt.Errorf("%w: %v", domain.ErrDependency, err)
	}
	lines, totals, err := domain.ComputeLines(in.Lines, rates.Allowed)
	if err != nil {
		return domain.Invoice{}, err
	}
	now := s.now()
	inv := domain.Invoice{
		ID: s.newID(), TenantID: a.TenantID, DocType: domain.DocFiscalInvoice, Environment: p.Environment,
		PointOfSaleCode: p.PointOfSaleCode, SourceType: in.SourceType, SourceID: in.SourceID, Customer: in.Customer,
		Lines: lines, Totals: totals, Currency: in.Currency, PaymentMethods: in.PaymentMethods,
		DocumentDate: panamaDate(now), LegalParamVersion: rates.Version, IdempotencyKey: in.IdempotencyKey,
		RequestHash: in.RequestHash, CreatedAt: now,
	}
	out, created, err := s.invoices.CreateInvoice(ctx, inv)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrIdempotencyReused), errors.Is(err, domain.ErrProfileMissing):
			return domain.Invoice{}, err
		}
		return domain.Invoice{}, observability.Wrap(err, "create invoice")
	}
	if created && s.metrics != nil {
		s.metrics.Inc("pp_invoices_total", "doc_type", "FISCAL_INVOICE", "status", "QUEUED")
	}
	return out, nil
}

// GetInvoice devuelve un documento del negocio.
func (s *Invoicing) GetInvoice(ctx context.Context, id string) (domain.Invoice, error) {
	a, err := actorWith(ctx, PermRead, PermIssue)
	if err != nil {
		return domain.Invoice{}, err
	}
	inv, err := s.invoices.GetInvoice(ctx, a.TenantID, id)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return inv, observability.Wrap(err, "load invoice")
	}
	return inv, err
}

// ListInvoices pagina los documentos del negocio.
func (s *Invoicing) ListInvoices(ctx context.Context, f store.ListFilter) ([]domain.Invoice, string, error) {
	a, err := actorWith(ctx, PermRead)
	if err != nil {
		return nil, "", err
	}
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit > 200 || f.Status < 0 || f.Status > domain.StatusVoided || f.DocType < 0 || f.DocType > domain.DocDebitNote {
		return nil, "", domain.ErrInvalidRequest
	}
	out, next, err := s.invoices.ListInvoices(ctx, a.TenantID, f)
	if err != nil && !errors.Is(err, domain.ErrInvalidRequest) {
		return nil, "", observability.Wrap(err, "list invoices")
	}
	return out, next, err
}

// ProcessDue envía al PAC los documentos vencidos, fuera de toda transacción de base (R3). Devuelve
// cuántos procesó. Un fallo de un documento se registra y no detiene a los demás.
func (s *Invoicing) ProcessDue(ctx context.Context, limit int) (int, error) {
	now := s.now()
	due, err := s.invoices.ClaimDue(ctx, now, limit, domain.SendLease)
	if err != nil {
		return 0, observability.Wrap(err, "claim due invoices")
	}
	for _, inv := range due {
		s.send(ctx, inv)
	}
	if age, err := s.invoices.PendingAgeSeconds(ctx, s.now()); err == nil && s.metrics != nil {
		s.metrics.Set("pp_invoices_pending_age_seconds_max", age)
	} else if err != nil {
		return len(due), observability.Wrap(err, "pending invoices age")
	}
	return len(due), nil
}

func (s *Invoicing) send(ctx context.Context, inv domain.Invoice) {
	client := s.pacs[providerFor(inv.Environment)]
	if client == nil {
		s.reschedule(ctx, inv, "no hay adaptador de PAC para el entorno "+inv.Environment)
		return
	}
	start := time.Now()
	res, err := client.Send(ctx, pac.Document{InvoiceID: inv.ID, TenantID: inv.TenantID, IssuerRUC: inv.IssuerRUC,
		IssuerDV: inv.IssuerDV, DocType: inv.DocType, PointOfSaleCode: inv.PointOfSaleCode, Number: inv.Number,
		TotalMinor: inv.Totals.TotalMinor, TaxMinor: inv.Totals.TaxMinor, IssuedAt: inv.CreatedAt})
	if s.metrics != nil {
		s.metrics.Observe("pp_pac_latency_seconds", time.Since(start).Seconds(), "provider", client.Provider())
	}
	if err != nil {
		s.reschedule(ctx, inv, "el PAC no respondió")
		if !errors.Is(err, pac.ErrTransient) && s.reporter != nil {
			s.reporter.Defect(ctx, "pac send failed", observability.Wrap(err, "send invoice to pac"))
		}
		return
	}
	at := s.now()
	ref := &pb.Reference{Type: inv.SourceType, Id: inv.SourceID}
	if res.Accepted {
		payload, err := proto.Marshal(&pb.InvoiceAccepted{InvoiceId: inv.ID, TenantId: inv.TenantID, Cufe: res.CUFE, Source: ref})
		if err == nil {
			err = s.invoices.MarkAccepted(ctx, inv.ID, res.CUFE, res.QR, at, store.OutboxEvent{ID: s.newID(),
				TenantID: inv.TenantID, AggregateID: inv.ID, Subject: events.SubjectInvoiceAccepted, Payload: payload, CreatedAt: at})
		}
		s.finish(ctx, err, "ACCEPTED")
		return
	}
	payload, err := proto.Marshal(&pb.InvoiceRejected{InvoiceId: inv.ID, TenantId: inv.TenantID, Reason: res.RejectionReason, Source: ref})
	if err == nil {
		err = s.invoices.MarkRejected(ctx, inv.ID, res.RejectionReason, at, store.OutboxEvent{ID: s.newID(),
			TenantID: inv.TenantID, AggregateID: inv.ID, Subject: events.SubjectInvoiceRejected, Payload: payload, CreatedAt: at})
	}
	s.finish(ctx, err, "REJECTED")
}

func (s *Invoicing) finish(ctx context.Context, err error, status string) {
	if err != nil {
		// La respuesta del PAC no se pudo guardar: el lease vence y el documento se reintenta.
		if s.reporter != nil {
			s.reporter.Dependency(ctx, "save pac result failed", "postgres-db", observability.Wrap(err, "save pac result"))
		}
		return
	}
	if s.metrics != nil {
		s.metrics.Inc("pp_invoices_total", "doc_type", "FISCAL_INVOICE", "status", status)
	}
}

func (s *Invoicing) reschedule(ctx context.Context, inv domain.Invoice, why string) {
	now := s.now()
	if err := s.invoices.Reschedule(ctx, inv.ID, now.Add(domain.NextRetry(inv.PacAttempts)), why, now); err != nil && s.reporter != nil {
		s.reporter.Dependency(ctx, "reschedule invoice failed", "postgres-db", observability.Wrap(err, "reschedule invoice"))
	}
}

// providerFor: DEMO usa el simulador; PROD usará el PAC elegido (Q-11).
func providerFor(env string) string {
	if env == domain.EnvDemo {
		return domain.ProviderSimulator
	}
	return ""
}

// panamaDate es la fecha del documento en la zona de negocio (domain-model §10.2: UTC−5 sin horario de
// verano), sin depender de la base de zonas horarias de la imagen.
func panamaDate(t time.Time) time.Time {
	p := t.UTC().Add(-5 * time.Hour)
	return time.Date(p.Year(), p.Month(), p.Day(), 0, 0, 0, 0, time.UTC)
}
