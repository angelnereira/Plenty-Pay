// Package pac es el puerto hacia los proveedores autorizados de certificación (SPEC R10, ADR 0022).
// Es neutral: no conoce a ningún proveedor. Cada PAC vive en su subpaquete (pac/hka, pac/simulator…)
// e implementa Client; el mapeo al catálogo de la DGI, común a todos, está en pac/dgi. El resto del
// servicio solo ve esta interfaz y el registro, así que cambiar o sumar un PAC no toca el dominio, la
// base, el servidor ni la app.
package pac

import (
	"context"
	"errors"
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

// CredentialField describe una credencial que pide el PAC: la app arma el formulario con esto y no
// conoce a ningún proveedor.
type CredentialField struct {
	Key    string
	Label  string
	Secret bool
}

// Info describe un adaptador para el selector (ListPacProviders).
type Info struct {
	ID           string
	DisplayName  string
	Environments []string // entornos habilitados hoy
	Credentials  []CredentialField
	Simulated    bool // sin validez fiscal: nunca atiende PROD
}

// CredentialKeys son las claves del JSON de credenciales.
func (i Info) CredentialKeys() []string {
	out := make([]string, len(i.Credentials))
	for n, c := range i.Credentials {
		out[n] = c.Key
	}
	return out
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

// Supports dice si el adaptador atiende el entorno (domain.Supports). Un adaptador simulado nunca
// atiende producción, aunque lo declare (R9).
func (r *Registry) Supports(provider, environment string) bool {
	c := r.Get(provider)
	if c == nil {
		return false
	}
	info := c.Info()
	if info.Simulated && environment == domain.EnvProd {
		return false
	}
	for _, e := range info.Environments {
		if e == environment {
			return true
		}
	}
	return false
}
