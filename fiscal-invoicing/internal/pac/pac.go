// Package pac tiene los adaptadores a los proveedores autorizados de certificación (SPEC R10,
// ADR 0022): una interfaz por proveedor y un registro que el perfil fiscal usa como selector.
// Adaptadores: HKA (The Factory HKA, hka.go) y el simulador sin red.
package pac

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"plentypay/fiscal-invoicing/internal/domain"
)

// Document es lo que se transmite al PAC: emisor, número asignado (R2), receptor, líneas y totales
// ya calculados en centavos (R1). Los montos nunca pasan por float (ADR 0013).
type Document struct {
	InvoiceID       string
	TenantID        string
	Environment     string // "DEMO" | "PROD" del documento
	IssuerRUC       string
	IssuerDV        string
	BranchCode      string // código de sucursal (4 dígitos)
	DocType         int
	PointOfSaleCode string
	Number          int64
	Customer        *domain.Taxpayer // nil = consumidor final sin identificar
	Lines           []domain.Line
	Totals          domain.Totals
	Currency        string
	PaymentMethods  []string
	RateClasses     map[int64]string // tasa en bps → clase legal vigente en la fecha del documento
	RelatedCUFE     string           // notas: CUFE de la factura que corrigen
	RelatedIssuedAt time.Time
	IssuedAt        time.Time
}

// Result es la respuesta definitiva del PAC.
type Result struct {
	Accepted        bool
	CUFE            string
	QR              string // contenido del código QR de verificación (R4)
	RejectionReason string
}

// Credentials son las credenciales del negocio ante el PAC, leídas de security al enviar. Nunca se
// registran (AGENTS.md §2.16).
type Credentials map[string]string

// ErrTransient: el PAC no respondió o pidió reintentar; el documento sigue en cola (R3, N-FIS-09).
var ErrTransient = errors.New("pac transient failure")

// ErrInvalidDocument: el documento no cumple el formato del PAC. En la emisión se detecta antes de
// numerar (Check); si aparece al enviar es un defecto de PlentyPay.
var ErrInvalidDocument = errors.New("pac invalid document")

// RetryError es un fallo transitorio con un mensaje para la persona (español, sin detalle interno) y
// si requiere atención del negocio u operador (credenciales, folios): Alert.
type RetryError struct {
	Message string
	Alert   bool
	Err     error
}

func (e *RetryError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

// Unwrap expone la causa y ErrTransient (errors.Is(err, ErrTransient) es true).
func (e *RetryError) Unwrap() []error { return []error{ErrTransient, e.Err} }

// Info describe un adaptador para el selector de la app (ListPacProviders).
type Info struct {
	ID             string
	DisplayName    string
	Environments   []string // entornos habilitados hoy
	CredentialKeys []string // claves del JSON de credenciales que pide
}

// Client es la interfaz de cada proveedor (R10).
type Client interface {
	Info() Info
	// Check valida el documento sin red, antes de consumir un folio. Devuelve un error de dominio
	// (ErrInvalidTaxpayer o ErrInvalidRequest) envuelto con el detalle.
	Check(d Document) error
	Send(ctx context.Context, creds Credentials, d Document) (Result, error)
}

// FolioCounter lo implementa un PAC que informa cuántos folios le quedan a la cuenta.
type FolioCounter interface {
	RemainingFolios(ctx context.Context, environment string, creds Credentials) (int64, error)
}

// Registry es el selector de adaptadores, en el orden en que se registran.
type Registry struct {
	order   []string
	clients map[string]Client
}

// NewRegistry registra los adaptadores disponibles.
func NewRegistry(cs ...Client) *Registry {
	r := &Registry{clients: map[string]Client{}}
	for _, c := range cs {
		id := c.Info().ID
		if _, dup := r.clients[id]; !dup {
			r.order = append(r.order, id)
		}
		r.clients[id] = c
	}
	return r
}

// Get devuelve el adaptador o nil.
func (r *Registry) Get(id string) Client {
	if r == nil {
		return nil
	}
	return r.clients[id]
}

// List describe los adaptadores registrados.
func (r *Registry) List() []Info {
	out := make([]Info, 0, len(r.order))
	for _, id := range r.order {
		out = append(out, r.clients[id].Info())
	}
	return out
}

// Supports dice si el adaptador atiende el entorno (domain.Supports).
func (r *Registry) Supports(provider, environment string) bool {
	c := r.Get(provider)
	if c == nil {
		return false
	}
	for _, e := range c.Info().Environments {
		if e == environment {
			return true
		}
	}
	return false
}

// SimulatorPrefix marca todo CUFE del simulador: nunca puede confundirse con uno de la DGI (R9).
const SimulatorPrefix = "DEMO-"

// DemoQRNotice va en el QR del simulador: el documento no tiene validez fiscal (AGENTS.md §2.12).
const DemoQRNotice = "PLENTYPAY DOCUMENTO DE PRUEBA SIN VALIDEZ FISCAL "

// Simulator acepta todo documento con un CUFE determinista con prefijo DEMO- (R9). Para las pruebas
// puede fallar de forma transitoria las primeras veces o rechazar.
type Simulator struct {
	mu           sync.Mutex
	failuresLeft int
	rejectReason string
	sent         []Document
}

// NewSimulator crea el simulador del entorno DEMO.
func NewSimulator() *Simulator { return &Simulator{} }

// FailNext hace que las próximas n llamadas fallen de forma transitoria (prueba de aceptación 2).
func (s *Simulator) FailNext(n int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failuresLeft = n
}

// RejectWith hace que el simulador rechace con ese motivo.
func (s *Simulator) RejectWith(reason string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rejectReason = reason
}

// Sent devuelve los documentos recibidos (pruebas).
func (s *Simulator) Sent() []Document {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Document(nil), s.sent...)
}

// Info describe el simulador: solo DEMO y sin credenciales.
func (s *Simulator) Info() Info {
	return Info{ID: domain.ProviderSimulator, DisplayName: "Simulador de PlentyPay (sin validez fiscal)",
		Environments: []string{domain.EnvDemo}}
}

// Check no tiene reglas propias: el dominio ya validó el documento.
func (s *Simulator) Check(Document) error { return nil }

// Send simula la transmisión.
func (s *Simulator) Send(ctx context.Context, _ Credentials, d Document) (Result, error) {
	if err := ctx.Err(); err != nil {
		return Result{}, &RetryError{Message: "el PAC no respondió", Err: err}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sent = append(s.sent, d)
	if s.failuresLeft > 0 {
		s.failuresLeft--
		return Result{}, &RetryError{Message: "el PAC no respondió", Err: errors.New("simulated timeout")}
	}
	if s.rejectReason != "" {
		return Result{Accepted: false, RejectionReason: s.rejectReason}, nil
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%d|%s|%d", d.TenantID, d.IssuerRUC, d.DocType, d.PointOfSaleCode, d.Number)))
	cufe := SimulatorPrefix + hex.EncodeToString(sum[:])[:40]
	return Result{Accepted: true, CUFE: cufe, QR: DemoQRNotice + cufe}, nil
}
