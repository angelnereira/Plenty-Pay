package domain

// Tipos de documento (mismos números que DocumentType del contrato).
const (
	DocFiscalInvoice   = 1
	DocCreditNote      = 2
	DocDebitNote       = 3
	DocInternalReceipt = 4
)

// PolicyDecision es la respuesta de EvaluateDocumentPolicy.
type PolicyDecision struct {
	DocType               int
	AppliedPreference     int
	NeedsCustomerDecision bool
}

// EvaluatePolicy aplica la preferencia fiscal del negocio (domain-model §8.8, N-FIS-04):
//   - ALWAYS_FISCAL → factura;
//   - INTERNAL_ONLY → recibo interno (la app avisa que no sustituye a la factura);
//   - ASK_ALWAYS → factura por defecto y el cajero confirma;
//   - AUTO_THRESHOLD → factura si total ≥ umbral, o si el cliente la pide o aporta RUC/cédula.
func EvaluatePolicy(p Profile, totalMinor int64, customerRequestsFiscal, customerHasTaxID bool) PolicyDecision {
	d := PolicyDecision{AppliedPreference: p.CheckoutPreference, DocType: DocFiscalInvoice}
	switch p.CheckoutPreference {
	case PrefInternalOnly:
		d.DocType = DocInternalReceipt
	case PrefAskAlways:
		d.NeedsCustomerDecision = true
	case PrefAutoThreshold:
		threshold := int64(0)
		if p.AutoThresholdMinor != nil {
			threshold = *p.AutoThresholdMinor
		}
		if totalMinor < threshold && !customerRequestsFiscal && !customerHasTaxID {
			d.DocType = DocInternalReceipt
		}
	}
	return d
}
