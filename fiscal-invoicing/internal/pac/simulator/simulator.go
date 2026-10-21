// Package simulator es el PAC simulado de PlentyPay: sin red, sin credenciales y sin validez fiscal
// (SPEC R9). Sirve para pruebas y para negocios que aún no contratan un PAC.
package simulator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/pac"
)

// Prefix marca todo CUFE del simulador: nunca puede confundirse con uno de la DGI (R9).
const Prefix = "DEMO-"

// QRNotice va en el QR del simulador: el documento no tiene validez fiscal (AGENTS.md §2.12).
const QRNotice = "PLENTYPAY DOCUMENTO DE PRUEBA SIN VALIDEZ FISCAL "

// Simulator acepta todo documento con un CUFE determinista con prefijo DEMO- (R9). Para las pruebas
// puede fallar de forma transitoria las primeras veces o rechazar.
type Simulator struct {
	mu           sync.Mutex
	failuresLeft int
	rejectReason string
	sent         []pac.Document
}

// New crea el simulador.
func New() *Simulator { return &Simulator{} }

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
func (s *Simulator) Sent() []pac.Document {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]pac.Document(nil), s.sent...)
}

// Info describe el simulador: solo DEMO, sin credenciales.
func (s *Simulator) Info() pac.Info {
	return pac.Info{ID: domain.ProviderSimulator, DisplayName: "Simulador de PlentyPay (sin validez fiscal)",
		Environments: []string{domain.EnvDemo}, Simulated: true}
}

// Check no tiene reglas propias: el dominio ya validó el documento.
func (s *Simulator) Check(pac.Document) error { return nil }

// Send simula la transmisión.
func (s *Simulator) Send(ctx context.Context, _ pac.Credentials, d pac.Document) (pac.Result, error) {
	if err := ctx.Err(); err != nil {
		return pac.Result{}, &pac.RetryError{Message: "el PAC no respondió", Err: err}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sent = append(s.sent, d)
	if s.failuresLeft > 0 {
		s.failuresLeft--
		return pac.Result{}, &pac.RetryError{Message: "el PAC no respondió", Err: errors.New("simulated timeout")}
	}
	if s.rejectReason != "" {
		return pac.Result{Accepted: false, RejectionReason: s.rejectReason}, nil
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%d|%s|%d", d.TenantID, d.IssuerRUC, d.DocType, d.PointOfSaleCode, d.Number)))
	cufe := Prefix + hex.EncodeToString(sum[:])[:40]
	return pac.Result{Accepted: true, CUFE: cufe, QR: QRNotice + cufe}, nil
}
