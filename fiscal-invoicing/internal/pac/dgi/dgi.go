// Package dgi traduce un documento de PlentyPay al contenido de la factura electrónica de la DGI
// (SFEP): códigos del catálogo, receptor, líneas y totales como texto decimal exacto. Es común a todo
// PAC de Panamá: cada adaptador (pac/hka, …) solo convierte este Document al formato de su servicio y
// lo transporta (ADR 0022). Nada aquí depende de un proveedor.
package dgi

import (
	"fmt"
	"math/big"
	"strings"
	"time"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/pac"
)

// Tipos de documento (TipoDocumento).
const (
	DocInvoice    = "01" // factura de operación interna
	DocCreditNote = "04" // nota de crédito referente a una factura
	DocDebitNote  = "05" // nota de débito referente a una factura
)

// Naturaleza de la operación.
const (
	NatureSale   = "01"
	NatureReturn = "11"
)

// Tipos de receptor (TipoClienteFE).
const (
	ReceiverTaxpayer   = "01"
	ReceiverConsumer   = "02"
	ReceiverGovernment = "03"
	ReceiverForeign    = "04"
)

// Tipo de contribuyente.
const (
	TaxpayerNatural = "1"
	TaxpayerLegal   = "2"
)

// Identificación de un receptor extranjero.
const (
	ForeignPassport = "01"
	ForeignOther    = "99"
)

// Códigos de tasa de ITBMS por clase legal. El código identifica la clase; el valor de la tasa siempre
// sale de legal.pa.itbms.* (AGENTS.md §2.13).
var rateCodes = map[string]string{
	domain.RateExempt:   "00",
	domain.RateStandard: "01",
	domain.RateAlcohol:  "02",
	domain.RateTobacco:  "03",
}

// Formas de pago de PlentyPay → catálogo de la DGI. "CARD" sin distinguir y "WALLET" van como "99"
// (otro) con descripción, para no declarar un tipo de tarjeta que no se conoce.
var paymentCodes = map[string]Payment{
	"CREDIT":      {Code: "01"},
	"CASH":        {Code: "02"},
	"CREDIT_CARD": {Code: "03"},
	"DEBIT_CARD":  {Code: "04"},
	"TRANSFER":    {Code: "08"},
	"CHECK":       {Code: "09"},
	"CARD":        {Code: "99", Description: "Tarjeta"},
	"WALLET":      {Code: "99", Description: "Billetera digital"},
}

// Document es la factura electrónica de la DGI, neutral respecto del PAC.
type Document struct {
	DocType     string
	Number      string // 10 dígitos
	PointOfSale string // 3 dígitos, nunca "000"
	Branch      string // 4 dígitos
	IssuedAt    time.Time
	Nature      string
	Receiver    Receiver
	Items       []Item
	Totals      Totals
	Payment     Payment
	Related     *Reference // notas
}

// Receiver es el receptor del documento.
type Receiver struct {
	Type         string // ReceiverTaxpayer…
	TaxpayerKind string // TaxpayerNatural | TaxpayerLegal
	RUC          string
	DV           string
	Name         string
	Address      string
	Location     string // provincia-distrito-corregimiento
	ForeignType  string // ForeignPassport | ForeignOther
	ForeignID    string
	Email        string
	Country      string // "PA": operación dentro de Panamá
}

// Item es una línea. Todos los montos son texto decimal exacto.
type Item struct {
	Description  string
	Quantity     string // tres decimales
	UnitPrice    string
	UnitDiscount string // por unidad, seis decimales; "" sin descuento
	Price        string // cantidad × (precio − descuento) = base de la línea
	RateCode     string
	Tax          string
	Total        string
	CPBS         string
	CPBSAbbrev   string
	CPBSUnit     string
}

// Totals son los totales del documento.
type Totals struct {
	Net      string
	Tax      string
	Taxed    string // monto gravado = ITBMS total (como lo pide el formato de la DGI)
	Total    string
	Received string
	AllItems string
	Items    int
}

// Payment es la forma de pago.
type Payment struct {
	Code        string
	Description string
	Amount      string
}

// Reference es la factura que corrige una nota.
type Reference struct {
	CUFE     string
	IssuedAt time.Time
}

// PadNumber escribe el número del documento con 10 dígitos.
func PadNumber(n int64) string { return fmt.Sprintf("%010d", n) }

// Build arma el documento DGI y aplica las reglas del formato que no dependen del PAC. Un error del
// receptor es domain.ErrInvalidTaxpayer; el resto, domain.ErrInvalidRequest.
func Build(d pac.Document) (Document, error) {
	if d.Currency != "USD" {
		return Document{}, fmt.Errorf("%w: la factura electrónica se emite en USD/balboas, no %q", domain.ErrInvalidRequest, d.Currency)
	}
	if len(d.PaymentMethods) != 1 {
		// La DGI exige el monto de cada forma de pago y el contrato aún no lo trae.
		return Document{}, fmt.Errorf("%w: se admite exactamente una forma de pago", domain.ErrInvalidRequest)
	}
	pay, ok := paymentCodes[strings.ToUpper(strings.TrimSpace(d.PaymentMethods[0]))]
	if !ok {
		return Document{}, fmt.Errorf("%w: forma de pago %q sin código DGI", domain.ErrInvalidRequest, d.PaymentMethods[0])
	}
	pay.Amount = Money(d.Totals.TotalMinor)
	if d.PointOfSaleCode == "000" {
		return Document{}, fmt.Errorf("%w: punto de facturación 000", domain.ErrInvalidRequest)
	}
	receiver, err := buildReceiver(d.Customer)
	if err != nil {
		return Document{}, err
	}
	gov := receiver.Type == ReceiverGovernment
	items := make([]Item, 0, len(d.Lines))
	var linesTotal int64
	for i, l := range d.Lines {
		class, ok := d.RateClasses[l.TaxRateBps]
		code, known := rateCodes[class]
		if !ok || !known {
			return Document{}, fmt.Errorf("%w: línea %d con tasa %d bps sin clase legal", domain.ErrInvalidRequest, i+1, l.TaxRateBps)
		}
		it := Item{Description: l.Description, Quantity: Quantity(l.QuantityMilli), UnitPrice: Money(l.UnitPriceMinor),
			Price: Money(l.BaseMinor), RateCode: code, Tax: Money(l.TaxMinor), Total: Money(l.TotalMinor)}
		if l.DiscountMinor > 0 {
			it.UnitDiscount = UnitDiscount(l.DiscountMinor, l.QuantityMilli)
		}
		if c := strings.TrimSpace(l.CPBSCode); len(c) == 4 {
			it.CPBS, it.CPBSAbbrev = c, c[:2]
			if gov {
				it.CPBSUnit = l.UnitMeasureCode
			}
		}
		if gov && (it.CPBS == "" || it.CPBSUnit == "") {
			return Document{}, fmt.Errorf("%w: a una entidad del Estado cada línea lleva código CPBS y unidad", domain.ErrInvalidRequest)
		}
		items = append(items, it)
		linesTotal += l.TotalMinor
	}
	doc := Document{
		DocType: DocInvoice, Number: PadNumber(d.Number), PointOfSale: d.PointOfSaleCode, Branch: d.BranchCode,
		IssuedAt: d.IssuedAt, Nature: NatureSale, Receiver: receiver, Items: items, Payment: pay,
		Totals: Totals{Net: Money(d.Totals.SubtotalMinor), Tax: Money(d.Totals.TaxMinor), Taxed: Money(d.Totals.TaxMinor),
			Total: Money(d.Totals.TotalMinor), Received: Money(d.Totals.TotalMinor), AllItems: Money(linesTotal), Items: len(items)},
	}
	switch d.DocType {
	case domain.DocCreditNote, domain.DocDebitNote:
		if d.RelatedCUFE == "" {
			return Document{}, fmt.Errorf("%w: la nota no tiene el CUFE de la factura", domain.ErrInvalidRequest)
		}
		doc.DocType, doc.Related = DocDebitNote, &Reference{CUFE: d.RelatedCUFE, IssuedAt: d.RelatedIssuedAt}
		if d.DocType == domain.DocCreditNote {
			doc.DocType, doc.Nature = DocCreditNote, NatureReturn
		}
	}
	return doc, nil
}

// buildReceiver traduce el receptor según su tipo de identificación (ADR 0022 §8).
func buildReceiver(t *domain.Taxpayer) (Receiver, error) {
	r := Receiver{Country: "PA"}
	if t == nil {
		r.Type = ReceiverConsumer
		return r, nil
	}
	r.Name, r.Email = t.LegalName, t.Email
	switch t.TaxIDType {
	case domain.TaxIDRUCJuridico, domain.TaxIDRUCNatural, domain.TaxIDGobierno:
		r.Type, r.TaxpayerKind = ReceiverTaxpayer, TaxpayerLegal
		if t.TaxIDType == domain.TaxIDRUCNatural {
			r.TaxpayerKind = TaxpayerNatural
		}
		if t.TaxIDType == domain.TaxIDGobierno {
			r.Type = ReceiverGovernment
		}
		r.RUC, r.DV, r.Address, r.Location = t.TaxID, t.CheckDigit, t.Address, t.Location
		// Contribuyente y gobierno: la DGI exige la dirección (5–100 caracteres).
		if n := len([]rune(t.Address)); n < 5 || n > 100 {
			return r, fmt.Errorf("%w: falta la dirección del receptor", domain.ErrInvalidTaxpayer)
		}
	case domain.TaxIDCedula:
		r.Type, r.TaxpayerKind = ReceiverConsumer, TaxpayerNatural
		r.RUC, r.Address, r.Location = t.TaxID, t.Address, t.Location
	case domain.TaxIDPasaporte, domain.TaxIDExtranjero:
		r.Type, r.ForeignType = ReceiverForeign, ForeignOther
		if t.TaxIDType == domain.TaxIDPasaporte {
			r.ForeignType = ForeignPassport
		}
		r.ForeignID, r.Address = t.TaxID, t.Address
	default:
		return r, fmt.Errorf("%w: tipo de identificación %q", domain.ErrInvalidTaxpayer, t.TaxIDType)
	}
	return r, nil
}

// Money escribe centavos como balboas con dos decimales ("12.34").
func Money(minor int64) string {
	sign := ""
	if minor < 0 {
		sign, minor = "-", -minor
	}
	return fmt.Sprintf("%s%d.%02d", sign, minor/100, minor%100)
}

// Quantity escribe milésimas de unidad con tres decimales ("1.500").
func Quantity(milli int64) string { return fmt.Sprintf("%d.%03d", milli/1000, milli%1000) }

// UnitDiscount reparte el descuento de la línea por unidad, en millonésimas de balboa redondeadas
// half-up (seis decimales). Se usa big.Int: centavos × 10⁷ no cabe en int64.
func UnitDiscount(discountMinor, qtyMilli int64) string {
	num := new(big.Int).Mul(big.NewInt(discountMinor), big.NewInt(10_000*1000))
	den := big.NewInt(qtyMilli)
	q, r := new(big.Int).QuoRem(num, den, new(big.Int))
	if new(big.Int).Mul(r, big.NewInt(2)).Cmp(den) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	micro := q.Int64()
	return fmt.Sprintf("%d.%06d", micro/1_000_000, micro%1_000_000)
}
