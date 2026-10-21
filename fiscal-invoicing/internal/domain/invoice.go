package domain

import (
	"regexp"
	"time"
)

// Estados de un documento (mismos números que InvoiceStatus del contrato; domain-model §8.8).
const (
	StatusDraft    = 1
	StatusQueued   = 2
	StatusSent     = 3
	StatusAccepted = 4
	StatusRejected = 5
	StatusVoided   = 6
)

// Orígenes de un documento (SPEC §3 invoices.source_type).
var sourceTypes = map[string]bool{"sale": true, "sub_order": true, "manual": true, "platform_fee": true}

var currencyRe = regexp.MustCompile(`^[A-Z]{3}$`)

// Invoice es un documento fiscal (factura o nota).
type Invoice struct {
	ID                string
	TenantID          string
	DocType           int
	Status            int
	Environment       string
	PointOfSaleCode   string
	Number            int64
	CUFE              string
	QR                string
	RelatedInvoiceID  string
	SourceType        string
	SourceID          string
	Customer          *Taxpayer // nil = consumidor final
	Lines             []Line
	Totals            Totals
	Currency          string
	PaymentMethods    []string
	DocumentDate      time.Time
	LegalParamVersion string
	Reason            string
	PacAttempts       int
	NextAttemptAt     *time.Time
	LastError         string
	RejectionReason   string
	IdempotencyKey    string
	RequestHash       []byte
	IssuedAt          *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time

	// Datos del emisor que viajan al PAC (vienen del perfil, no se guardan en la fila).
	IssuerRUC string
	IssuerDV  string
}

// ValidateRequest revisa lo que manda quien emite, antes de calcular (SPEC §4 IssueInvoice).
func ValidateRequest(idempotencyKey, sourceType, sourceID, currency string, paymentMethods []string) error {
	if n := len(idempotencyKey); n < 16 || n > 100 {
		return ErrInvalidRequest
	}
	if !sourceTypes[sourceType] || sourceID == "" || len(sourceID) > 100 {
		return ErrInvalidRequest
	}
	if !currencyRe.MatchString(currency) {
		return ErrInvalidRequest
	}
	if len(paymentMethods) > 10 {
		return ErrInvalidRequest
	}
	for _, m := range paymentMethods {
		if m == "" || len(m) > 40 {
			return ErrInvalidRequest
		}
	}
	return nil
}

// retrySchedule son las esperas entre intentos al PAC (R3): luego, cada hora. Una factura pendiente
// más de una hora dispara la alerta de `pp_invoices_pending_age_seconds_max`.
var retrySchedule = []time.Duration{30 * time.Second, time.Minute, 2 * time.Minute, 5 * time.Minute,
	15 * time.Minute, 30 * time.Minute, time.Hour}

// NextRetry devuelve la espera tras el intento número attempt (1 = el primero).
func NextRetry(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	if attempt > len(retrySchedule) {
		return retrySchedule[len(retrySchedule)-1]
	}
	return retrySchedule[attempt-1]
}

// SendLease es cuánto se reserva un documento para un envío: si el proceso cae a mitad, otro worker
// lo retoma al vencer (R3: nunca se pierde, nunca se envía dos veces a la vez).
const SendLease = 2 * time.Minute
