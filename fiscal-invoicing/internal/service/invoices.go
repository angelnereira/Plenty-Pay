package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
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
	"plentypay/fiscal-invoicing/internal/tenancy"
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
	metrics  *observability.Metrics
	reporter *observability.Reporter
}

// NewInvoicing arma la emisión sobre el servicio base (que tiene el registro de PAC).
func NewInvoicing(base *Service, invoices InvoiceStore, rates RatesAPI,
	metrics *observability.Metrics, reporter *observability.Reporter) *Invoicing {
	return &Invoicing{Service: base, invoices: invoices, rates: rates, metrics: metrics, reporter: reporter}
}

// pacDocument es lo que viaja al adaptador. La clase de cada tasa sale de los parámetros legales
// guardados en el documento (AGENTS.md §2.13).
func pacDocument(inv domain.Invoice) pac.Document {
	return pac.Document{InvoiceID: inv.ID, TenantID: inv.TenantID, Environment: inv.Environment, IssuerRUC: inv.IssuerRUC,
		IssuerDV: inv.IssuerDV, BranchCode: inv.BranchCode, DocType: inv.DocType, PointOfSaleCode: inv.PointOfSaleCode,
		Number: inv.Number, Customer: inv.Customer, Lines: inv.Lines, Totals: inv.Totals, Currency: inv.Currency,
		PaymentMethods: inv.PaymentMethods, RateClasses: domain.RateClasses(inv.LegalParamVersion),
		RelatedCUFE: inv.RelatedCUFE, RelatedIssuedAt: inv.RelatedCreatedAt, IssuedAt: inv.CreatedAt}
}

// precheck valida el documento con las reglas del PAC antes de numerarlo (R2: un folio no se gasta
// en un documento que el PAC rechazaría por formato). El número aún no existe: se usa 1.
func (s *Invoicing) precheck(inv domain.Invoice) error {
	cl := s.pacs.Get(inv.PacProvider)
	if cl == nil || !s.pacs.Supports(inv.PacProvider, inv.Environment) {
		return domain.ErrPacNotConfigured
	}
	inv.Number = 1
	return cl.Check(pacDocument(inv))
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
		RequestHash: in.RequestHash, CreatedAt: now, PacProvider: p.PACProvider, BranchCode: p.BranchCode,
		IssuerRUC: p.RUC, IssuerDV: p.DV,
	}
	if err := s.precheck(inv); err != nil {
		return domain.Invoice{}, err
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

// credentials lee de security las credenciales del negocio para el adaptador (nunca se registran).
func (s *Invoicing) credentials(ctx context.Context, cl pac.Client, inv domain.Invoice) (pac.Credentials, error) {
	if len(cl.Info().CredentialKeys()) == 0 {
		return nil, nil
	}
	if inv.CredentialsSecret == "" {
		return nil, &pac.RetryError{Message: "faltan las credenciales del PAC", Alert: true}
	}
	raw, err := s.secrets.GetSecret(ctx, s.newID(), inv.CredentialsSecret)
	if err != nil {
		return nil, &pac.RetryError{Message: "no se pudieron leer las credenciales del PAC", Err: err}
	}
	var creds pac.Credentials
	if err := json.Unmarshal(raw, &creds); err != nil {
		return nil, &pac.RetryError{Message: "las credenciales del PAC están dañadas", Alert: true,
			Err: errors.New("decode pac credentials")} // sin el contenido: podría llevar el token
	}
	return creds, nil
}

func (s *Invoicing) send(ctx context.Context, inv domain.Invoice) {
	cl := s.pacs.Get(inv.PacProvider)
	if cl == nil {
		s.retry(ctx, inv, &pac.RetryError{Message: "el adaptador de PAC del documento no está disponible", Alert: true,
			Err: fmt.Errorf("pac provider %q not registered", inv.PacProvider)})
		return
	}
	provider := cl.Info().ID
	creds, err := s.credentials(ctx, cl, inv)
	if err != nil {
		s.retry(ctx, inv, err)
		return
	}
	start := time.Now()
	res, err := cl.Send(ctx, creds, pacDocument(inv))
	if s.metrics != nil {
		s.metrics.Observe("pp_pac_latency_seconds", time.Since(start).Seconds(), "provider", provider)
	}
	if errors.Is(err, pac.ErrInvalidDocument) {
		// Precheck lo debió impedir: es un defecto. El documento se rechaza para no reintentarlo sin fin.
		if s.reporter != nil {
			s.reporter.Defect(ctx, "pac rejected document format", observability.Wrap(err, "build pac document"),
				slog.String("pp.pac_provider", provider), slog.String("pp.invoice_id", inv.ID))
		}
		res, err = pac.Result{Accepted: false, RejectionReason: "el documento no cumple el formato del PAC"}, nil
	}
	if err != nil {
		s.retry(ctx, inv, err)
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
		s.finish(ctx, inv.DocType, err, "ACCEPTED")
		return
	}
	payload, err := proto.Marshal(&pb.InvoiceRejected{InvoiceId: inv.ID, TenantId: inv.TenantID, Reason: res.RejectionReason, Source: ref})
	if err == nil {
		err = s.invoices.MarkRejected(ctx, inv.ID, res.RejectionReason, at, store.OutboxEvent{ID: s.newID(),
			TenantID: inv.TenantID, AggregateID: inv.ID, Subject: events.SubjectInvoiceRejected, Payload: payload, CreatedAt: at})
	}
	s.finish(ctx, inv.DocType, err, "REJECTED")
}

func (s *Invoicing) finish(ctx context.Context, docType int, err error, status string) {
	if err != nil {
		// La respuesta del PAC no se pudo guardar: el lease vence y el documento se reintenta.
		if s.reporter != nil {
			s.reporter.Dependency(ctx, "save pac result failed", "postgres-db", observability.Wrap(err, "save pac result"))
		}
		return
	}
	if s.metrics != nil {
		s.metrics.Inc("pp_invoices_total", "doc_type", docTypeName(docType), "status", status)
	}
}

// retry deja el documento en cola con el mensaje para la persona. Lo que pide atención (credenciales,
// folios, PAC no disponible) se registra como fallo de dependencia; un error inesperado, como defecto.
func (s *Invoicing) retry(ctx context.Context, inv domain.Invoice, err error) {
	why := "el PAC no respondió"
	var re *pac.RetryError
	if errors.As(err, &re) {
		why = re.Message
	}
	s.reschedule(ctx, inv, why)
	if s.reporter == nil {
		return
	}
	attrs := []slog.Attr{slog.String("pp.pac_provider", inv.PacProvider), slog.String("pp.invoice_id", inv.ID)}
	switch {
	case re != nil && re.Alert:
		s.reporter.Dependency(ctx, "pac needs attention", "pac-"+inv.PacProvider, observability.Wrap(err, "send invoice to pac"), attrs...)
	case !errors.Is(err, pac.ErrTransient):
		s.reporter.Defect(ctx, "pac send failed", observability.Wrap(err, "send invoice to pac"), attrs...)
	}
}

func (s *Invoicing) reschedule(ctx context.Context, inv domain.Invoice, why string) {
	now := s.now()
	if err := s.invoices.Reschedule(ctx, inv.ID, now.Add(domain.NextRetry(inv.PacAttempts)), why, now); err != nil && s.reporter != nil {
		s.reporter.Dependency(ctx, "reschedule invoice failed", "postgres-db", observability.Wrap(err, "reschedule invoice"))
	}
}

// panamaDate es la fecha del documento en la zona de negocio (domain-model §10.2: UTC−5 sin horario de
// verano), sin depender de la base de zonas horarias de la imagen.
func panamaDate(t time.Time) time.Time {
	p := t.UTC().Add(-5 * time.Hour)
	return time.Date(p.Year(), p.Month(), p.Day(), 0, 0, 0, 0, time.UTC)
}

// NoteInput es la solicitud de nota de crédito o débito (fiscal_invoicing.proto IssueNoteRequest).
type NoteInput struct {
	IdempotencyKey   string
	RequestHash      []byte
	RelatedInvoiceID string
	Lines            []domain.Line
	Reason           string
}

// IssueNote emite una nota que corrige una factura aceptada (N-FIS-08, R7). Lleva el receptor, la
// moneda, el entorno y el punto de facturación de la factura original.
func (s *Invoicing) IssueNote(ctx context.Context, docType int, in NoteInput) (domain.Invoice, error) {
	a, err := actorWith(ctx, PermNoteIssue)
	if err != nil {
		return domain.Invoice{}, err
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if (docType != domain.DocCreditNote && docType != domain.DocDebitNote) || in.RelatedInvoiceID == "" ||
		in.Reason == "" || len([]rune(in.Reason)) > 200 {
		return domain.Invoice{}, domain.ErrInvalidRequest
	}
	if err := domain.ValidateRequest(in.IdempotencyKey, "note", in.IdempotencyKey, "USD", nil); err != nil {
		return domain.Invoice{}, err
	}
	orig, err := s.invoices.GetInvoice(ctx, a.TenantID, in.RelatedInvoiceID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.Invoice{}, err
		}
		return domain.Invoice{}, observability.Wrap(err, "load related invoice")
	}
	if orig.DocType != domain.DocFiscalInvoice || orig.Status != domain.StatusAccepted {
		return domain.Invoice{}, domain.ErrRelatedNotAccepted
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
	note := domain.Invoice{
		ID: s.newID(), TenantID: a.TenantID, DocType: docType, Environment: orig.Environment,
		PointOfSaleCode: orig.PointOfSaleCode, RelatedInvoiceID: orig.ID, SourceType: "note", SourceID: in.IdempotencyKey,
		Customer: orig.Customer, Lines: lines, Totals: totals, Currency: orig.Currency, DocumentDate: panamaDate(now),
		LegalParamVersion: rates.Version, Reason: in.Reason, IdempotencyKey: in.IdempotencyKey, RequestHash: in.RequestHash,
		CreatedAt: now, PaymentMethods: orig.PaymentMethods, PacProvider: orig.PacProvider, BranchCode: orig.BranchCode,
		RelatedCUFE: orig.CUFE, RelatedCreatedAt: orig.CreatedAt,
	}
	if err := s.precheck(note); err != nil {
		return domain.Invoice{}, err
	}
	out, created, err := s.invoices.CreateInvoice(ctx, note)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrIdempotencyReused), errors.Is(err, domain.ErrRelatedNotAccepted),
			errors.Is(err, domain.ErrExceedsOriginal), errors.Is(err, domain.ErrNotFound), errors.Is(err, domain.ErrProfileMissing):
			return domain.Invoice{}, err
		}
		return domain.Invoice{}, observability.Wrap(err, "create note")
	}
	if created && s.metrics != nil {
		s.metrics.Inc("pp_invoices_total", "doc_type", docTypeName(docType), "status", "QUEUED")
	}
	return out, nil
}

// docTypeName es la etiqueta de métrica del tipo de documento (valores acotados).
func docTypeName(t int) string {
	switch t {
	case domain.DocCreditNote:
		return "CREDIT_NOTE"
	case domain.DocDebitNote:
		return "DEBIT_NOTE"
	}
	return "FISCAL_INVOICE"
}

// FolioStatus son los folios del punto de facturación y, si el PAC lo informa, los de su cuenta.
type FolioStatus struct {
	store.FolioStatus
	PacRemaining int64 // -1 = el PAC no lo informa o no respondió
}

// FolioStatus agrega a los folios propios (R2) los que el PAC reporta disponibles (ADR 0022). Si el
// PAC no responde, la consulta no falla: PacRemaining queda en -1 y el fallo se registra.
func (s *Invoicing) FolioStatus(ctx context.Context) (FolioStatus, error) {
	st, err := s.Service.FolioStatus(ctx)
	out := FolioStatus{FolioStatus: st, PacRemaining: -1}
	if err != nil {
		return out, err
	}
	a := tenancy.FromContext(ctx)
	p, err := s.store.GetProfile(ctx, a.TenantID)
	if err != nil {
		return out, observability.Wrap(err, "load fiscal profile")
	}
	cl := s.pacs.Get(p.PACProvider)
	counter, ok := cl.(pac.FolioCounter)
	if !ok || p.PACCredentialsSecret == "" {
		return out, nil
	}
	creds, err := s.credentials(ctx, cl, domain.Invoice{CredentialsSecret: p.PACCredentialsSecret})
	if err == nil {
		out.PacRemaining, err = counter.RemainingFolios(ctx, p.Environment, creds)
	}
	if err != nil {
		out.PacRemaining = -1
		if s.reporter != nil {
			s.reporter.Dependency(ctx, "pac folios unavailable", "pac-"+p.PACProvider, observability.Wrap(err, "query pac folios"))
		}
	}
	return out, nil
}
