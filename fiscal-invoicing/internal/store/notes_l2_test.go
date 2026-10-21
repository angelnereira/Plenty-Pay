//go:build l2

package store_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"google.golang.org/grpc/metadata"

	"github.com/google/uuid"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/service"
)

func accountant(tenant string) context.Context {
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-pp-tenant-id", tenant,
		"x-pp-user-id", uuid.NewString(), "x-pp-permissions", "fiscal:read,fiscal:note:issue", "x-pp-actor-service", "api-gateway"))
}

func acceptedInvoice(t *testing.T, svc *service.Invoicing, tenant, source string) domain.Invoice {
	t.Helper()
	inv := issue(t, svc, tenant, "factura-"+source+"-idem", source)
	if _, err := svc.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	got, err := svc.GetInvoice(cashier(tenant), inv.ID)
	if err != nil || got.Status != domain.StatusAccepted {
		t.Fatalf("factura aceptada: %v %+v", err, got)
	}
	return got
}

// Aceptación 3 y R7: nota de crédito por el total → al aceptarse, la factura queda VOIDED.
func TestL2_Acceptance3_FullCreditNoteVoidsInvoice(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	inv := acceptedInvoice(t, svc, tenant, "sale-n1")
	note, err := svc.IssueNote(accountant(tenant), domain.DocCreditNote, service.NoteInput{IdempotencyKey: "nota-credito-n1-idem",
		RequestHash: []byte("n1"), RelatedInvoiceID: inv.ID, Lines: threeLines(), Reason: "Devolución total"})
	if err != nil || note.Number != 1 || note.RelatedInvoiceID != inv.ID || note.Totals.TotalMinor != inv.Totals.TotalMinor {
		t.Fatalf("nota: %v %+v", err, note)
	}
	if _, err := svc.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	got, _ := svc.GetInvoice(cashier(tenant), inv.ID)
	if got.Status != domain.StatusVoided {
		t.Fatalf("la factura debía quedar anulada: %+v", got)
	}
}

// R7: una nota parcial no anula; la suma de notas no supera el total; una nota sobre una factura no
// aceptada se rechaza (N-FIS-08).
func TestL2_R7_PartialNotesAndLimits(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	inv := acceptedInvoice(t, svc, tenant, "sale-n2")
	one := []domain.Line{{Description: "Taza", QuantityMilli: 1000, UnitPriceMinor: 1200, TaxRateBps: 700}}
	if _, err := svc.IssueNote(accountant(tenant), domain.DocCreditNote, service.NoteInput{IdempotencyKey: "nota-parcial-n2-idem",
		RequestHash: []byte("a"), RelatedInvoiceID: inv.ID, Lines: one, Reason: "Taza rota"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ProcessDue(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if got, _ := svc.GetInvoice(cashier(tenant), inv.ID); got.Status != domain.StatusAccepted {
		t.Fatalf("una nota parcial no anula: %+v", got)
	}
	_, err := svc.IssueNote(accountant(tenant), domain.DocCreditNote, service.NoteInput{IdempotencyKey: "nota-excede-n2-idem",
		RequestHash: []byte("b"), RelatedInvoiceID: inv.ID, Lines: threeLines(), Reason: "Excede"})
	if !errors.Is(err, domain.ErrExceedsOriginal) {
		t.Fatalf("la suma supera el total: %v", err)
	}
	queued := issue(t, svc, tenant, "factura-sin-enviar-idem", "sale-n3")
	_, err = svc.IssueNote(accountant(tenant), domain.DocDebitNote, service.NoteInput{IdempotencyKey: "nota-debito-n3-idem",
		RequestHash: []byte("c"), RelatedInvoiceID: queued.ID, Lines: one, Reason: "Recargo"})
	if !errors.Is(err, domain.ErrRelatedNotAccepted) {
		t.Fatalf("factura en cola: %v", err)
	}
	if _, err := svc.IssueNote(cashier(tenant), domain.DocCreditNote, service.NoteInput{IdempotencyKey: "nota-sin-permiso-idem",
		RelatedInvoiceID: inv.ID, Lines: one, Reason: "x"}); !errors.Is(err, domain.ErrPermissionDenied) {
		t.Fatalf("sin fiscal:note:issue: %v", err)
	}
}

// R7 bajo concurrencia: dos notas por el total al mismo tiempo → solo una pasa.
func TestL2_R7_ConcurrentNotesCannotExceed(t *testing.T) {
	s := open(t)
	tenant := newTenant(t, s)
	svc, _, _ := invoicing(t, s, rates{})
	inv := acceptedInvoice(t, svc, tenant, "sale-n4")
	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		ok, over int
	)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := svc.IssueNote(accountant(tenant), domain.DocCreditNote, service.NoteInput{
				IdempotencyKey: "nota-concurrente-" + string(rune('a'+i)) + "-idem", RequestHash: []byte{byte(i)},
				RelatedInvoiceID: inv.ID, Lines: threeLines(), Reason: "Devolución"})
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				ok++
			case errors.Is(err, domain.ErrExceedsOriginal):
				over++
			default:
				t.Errorf("error inesperado: %v", err)
			}
		}(i)
	}
	wg.Wait()
	if ok != 1 || over != 1 {
		t.Fatalf("una pasa y otra excede: ok=%d excede=%d", ok, over)
	}
}
