// Package pac es el adaptador al proveedor autorizado de certificación (SPEC R10): una interfaz por
// proveedor. Hoy solo existe el simulador del entorno DEMO; un PAC real llega con Q-11.
package pac

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Document es lo que se transmite al PAC: el emisor, el número asignado y los totales.
type Document struct {
	InvoiceID       string
	TenantID        string
	IssuerRUC       string
	IssuerDV        string
	DocType         int
	PointOfSaleCode string
	Number          int64
	TotalMinor      int64
	TaxMinor        int64
	IssuedAt        time.Time
}

// Result es la respuesta definitiva del PAC.
type Result struct {
	Accepted        bool
	CUFE            string
	QR              string // contenido del código QR de verificación (R4)
	RejectionReason string
}

// ErrTransient: el PAC no respondió o pidió reintentar; el documento sigue en cola (R3, N-FIS-09).
var ErrTransient = errors.New("pac transient failure")

// Client es la interfaz de cada proveedor (R10).
type Client interface {
	Provider() string
	Send(ctx context.Context, d Document) (Result, error)
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

// Provider es el nombre del adaptador.
func (s *Simulator) Provider() string { return "simulator" }

// Send simula la transmisión.
func (s *Simulator) Send(ctx context.Context, d Document) (Result, error) {
	if err := ctx.Err(); err != nil {
		return Result{}, fmt.Errorf("%w: %v", ErrTransient, err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sent = append(s.sent, d)
	if s.failuresLeft > 0 {
		s.failuresLeft--
		return Result{}, fmt.Errorf("%w: simulated timeout", ErrTransient)
	}
	if s.rejectReason != "" {
		return Result{Accepted: false, RejectionReason: s.rejectReason}, nil
	}
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%d|%s|%d", d.TenantID, d.IssuerRUC, d.DocType, d.PointOfSaleCode, d.Number)))
	cufe := SimulatorPrefix + hex.EncodeToString(sum[:])[:40]
	return Result{Accepted: true, CUFE: cufe, QR: DemoQRNotice + cufe}, nil
}
