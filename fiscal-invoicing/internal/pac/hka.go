package pac

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	hka "github.com/angelnereira/hka-sdk"
	"github.com/angelnereira/hka-sdk/types"
	"github.com/angelnereira/hka-sdk/validate"

	"plentypay/fiscal-invoicing/internal/domain"
)

// Claves del JSON de credenciales de HKA guardado en security (fiscal/<tenant>/pac).
const (
	HKATokenEmpresa  = "token_empresa"
	HKATokenPassword = "token_password"
)

// Endpoints publicados por The Factory HKA (ADR 0022 §3).
const (
	HKADemoEndpoint = hka.DemoEndpoint
	HKAProdEndpoint = "https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc"
)

// HKAConfig configura el adaptador. ProdEnabled es el interruptor operativo FISCAL_PROD_ENABLED
// (F30.3): sin él, PROD no se ofrece ni se envía.
type HKAConfig struct {
	DemoEndpoint string
	ProdEndpoint string
	Timeout      time.Duration
	ProdEnabled  bool
}

// HKA es el adaptador de The Factory HKA por github.com/angelnereira/hka-sdk (ADR 0022).
type HKA struct {
	demo        *hka.Client
	prod        *hka.Client
	prodEnabled bool
}

// NewHKA crea el adaptador. El SDK no reintenta: los reintentos son del worker (R3).
func NewHKA(cfg HKAConfig) *HKA {
	if cfg.DemoEndpoint == "" {
		cfg.DemoEndpoint = HKADemoEndpoint
	}
	if cfg.ProdEndpoint == "" {
		cfg.ProdEndpoint = HKAProdEndpoint
	}
	return &HKA{
		demo:        hka.New(&hka.Config{Endpoint: cfg.DemoEndpoint, Timeout: cfg.Timeout}),
		prod:        hka.New(&hka.Config{Endpoint: cfg.ProdEndpoint, Timeout: cfg.Timeout}),
		prodEnabled: cfg.ProdEnabled,
	}
}

// Info describe el adaptador para el selector.
func (h *HKA) Info() Info {
	envs := []string{domain.EnvDemo}
	if h.prodEnabled {
		envs = append(envs, domain.EnvProd)
	}
	return Info{ID: domain.ProviderHKA, DisplayName: "The Factory HKA", Environments: envs,
		CredentialKeys: []string{HKATokenEmpresa, HKATokenPassword}}
}

func (h *HKA) client(env string) (*hka.Client, error) {
	switch {
	case env == domain.EnvDemo:
		return h.demo, nil
	case env == domain.EnvProd && h.prodEnabled:
		return h.prod, nil
	}
	return nil, &RetryError{Message: "la emisión en producción no está habilitada", Alert: true}
}

// Check arma el documento de HKA y aplica la validación previa del SDK, sin red.
func (h *HKA) Check(d Document) error {
	doc, err := BuildHKADocument(d)
	if err != nil {
		return err
	}
	if ve := validate.Document(doc); ve != nil {
		return classify(ve)
	}
	return nil
}

// classify traduce los campos fallidos del SDK a errores de dominio: los del receptor son del
// receptor (ErrInvalidTaxpayer); el resto, de la solicitud.
func classify(ve *validate.ValidationError) error {
	for _, f := range ve.Fields {
		if strings.HasPrefix(f.Field, "Cliente.") {
			return fmt.Errorf("%w: %v", domain.ErrInvalidTaxpayer, ve)
		}
	}
	return fmt.Errorf("%w: %v", domain.ErrInvalidRequest, ve)
}

func credentials(c Credentials) (hka.Credentials, error) {
	out := hka.Credentials{TokenEmpresa: c[HKATokenEmpresa], TokenPassword: c[HKATokenPassword]}
	if out.TokenEmpresa == "" || out.TokenPassword == "" {
		return out, &RetryError{Message: "faltan las credenciales del PAC", Alert: true}
	}
	return out, nil
}

// Send transmite el documento y traduce la respuesta de HKA (ADR 0022 §8).
func (h *HKA) Send(ctx context.Context, creds Credentials, d Document) (Result, error) {
	cl, err := h.client(d.Environment)
	if err != nil {
		return Result{}, err
	}
	hc, err := credentials(creds)
	if err != nil {
		return Result{}, err
	}
	doc, err := BuildHKADocument(d)
	if err != nil {
		return Result{}, fmt.Errorf("%w: %v", ErrInvalidDocument, err)
	}
	resp, err := cl.Send(ctx, hc, doc)
	if err == nil {
		if resp.Code.IsSuccess() && resp.CUFE != "" {
			return Result{Accepted: true, CUFE: resp.CUFE, QR: resp.QR}, nil
		}
		return Result{}, &RetryError{Message: "el PAC pidió reenviar el documento", Err: fmt.Errorf("hka code %s", resp.Code)}
	}
	return h.translate(ctx, cl, hc, d, err)
}

func (h *HKA) translate(ctx context.Context, cl *hka.Client, hc hka.Credentials, d Document, err error) (Result, error) {
	var (
		ve *hka.ValidationError
		he *hka.HKAError
		ne *hka.NetworkError
	)
	switch {
	case errors.As(err, &ve):
		return Result{}, fmt.Errorf("%w: %v", ErrInvalidDocument, ve)
	case errors.As(err, &ne):
		return Result{}, &RetryError{Message: "el PAC no respondió", Err: err}
	case errors.As(err, &he):
		switch he.Code {
		case types.CodeDuplicate:
			// Ya se había enviado (p. ej. el proceso cayó tras enviar): se recupera el CUFE.
			st, serr := cl.DocumentStatus(ctx, hc, documentKey(d))
			if serr != nil || st.CUFE == "" {
				return Result{}, &RetryError{Message: "el PAC indica un documento duplicado; se consultará su estado", Err: errors.Join(err, serr)}
			}
			return Result{Accepted: true, CUFE: st.CUFE}, nil
		case types.CodeInvalidData:
			return Result{Accepted: false, RejectionReason: rejection(he.Message)}, nil
		case types.CodeNoFolios:
			return Result{}, &RetryError{Message: "la cuenta del PAC no tiene folios disponibles", Alert: true, Err: err}
		case types.CodeUnauthorized:
			return Result{}, &RetryError{Message: "el PAC rechazó las credenciales", Alert: true, Err: err}
		}
		return Result{}, &RetryError{Message: "el PAC respondió con un error", Alert: true, Err: err}
	}
	return Result{}, &RetryError{Message: "el PAC no respondió", Err: err}
}

// rejection es el motivo que verá la persona: el mensaje del PAC, acotado.
func rejection(msg string) string {
	msg = strings.Join(strings.Fields(msg), " ")
	if msg == "" {
		return "el PAC rechazó el documento"
	}
	if r := []rune(msg); len(r) > 500 {
		msg = string(r[:500])
	}
	return msg
}

// RemainingFolios consulta los folios disponibles de la cuenta (GetFolioStatus).
func (h *HKA) RemainingFolios(ctx context.Context, environment string, creds Credentials) (int64, error) {
	cl, err := h.client(environment)
	if err != nil {
		return 0, err
	}
	hc, err := credentials(creds)
	if err != nil {
		return 0, err
	}
	r, err := cl.RemainingFolios(ctx, hc)
	if err != nil {
		return 0, fmt.Errorf("hka folios restantes: %w", err)
	}
	n, err := strconv.ParseInt(strings.TrimSpace(r.FoliosDisponibles), 10, 64)
	if err != nil {
		return 0, fmt.Errorf("hka folios restantes ilegibles: %w", err)
	}
	return n, nil
}

func documentKey(d Document) hka.DocumentKey {
	return hka.DocumentKey{CodigoSucursalEmisor: d.BranchCode, NumeroDocumentoFiscal: hka.PadDocNumber(d.Number),
		PuntoFacturacionFiscal: d.PointOfSaleCode, TipoDocumento: docType(d.DocType), TipoEmision: types.EmisionAUPNormal}
}

func docType(t int) types.TipoDocumento {
	switch t {
	case domain.DocCreditNote:
		return types.TipoDocNotaCreditoRef
	case domain.DocDebitNote:
		return types.TipoDocNotaDebitoRef
	}
	return types.TipoDocFacturaInterna
}

// rateCodes son los códigos de tasa del catálogo de la DGI por clase legal (ADR 0022 §6). El código
// identifica la clase; el valor de la tasa siempre sale de legal.pa.itbms.* (AGENTS.md §2.13).
var rateCodes = map[string]types.TasaITBMS{
	domain.RateExempt:   types.ITBMSExento,
	domain.RateStandard: types.ITBMS7,
	domain.RateAlcohol:  types.ITBMS10,
	domain.RateTobacco:  types.ITBMS15,
}

// paymentCodes traduce las formas de pago de PlentyPay al catálogo de la DGI (ADR 0022 §6).
var paymentCodes = map[string]types.FormaPagoItem{
	"CASH":        {FormaPagoFact: types.PagoEfectivo},
	"CREDIT_CARD": {FormaPagoFact: types.PagoTarjetaCredito},
	"DEBIT_CARD":  {FormaPagoFact: types.PagoTarjetaDebito},
	"CARD":        {FormaPagoFact: types.PagoOtro, DescFormaPago: "Tarjeta"},
	"TRANSFER":    {FormaPagoFact: types.PagoTransferencia},
	"CHECK":       {FormaPagoFact: types.PagoCheque},
	"CREDIT":      {FormaPagoFact: types.PagoCredito},
	"WALLET":      {FormaPagoFact: types.PagoOtro, DescFormaPago: "Billetera digital"},
}

// BuildHKADocument arma el documento electrónico de HKA desde los centavos del dominio. Ningún monto
// pasa por float (ADR 0013): todos se escriben como texto decimal exacto.
func BuildHKADocument(d Document) (*types.DocumentoElectronico, error) {
	if d.Currency != "USD" {
		return nil, fmt.Errorf("%w: HKA emite en USD/balboas, no %q", domain.ErrInvalidRequest, d.Currency)
	}
	if len(d.PaymentMethods) != 1 {
		// Con varios medios, la DGI exige el monto de cada uno y el contrato aún no lo trae.
		return nil, fmt.Errorf("%w: HKA necesita exactamente una forma de pago", domain.ErrInvalidRequest)
	}
	pay, ok := paymentCodes[strings.ToUpper(strings.TrimSpace(d.PaymentMethods[0]))]
	if !ok {
		return nil, fmt.Errorf("%w: forma de pago %q sin código DGI", domain.ErrInvalidRequest, d.PaymentMethods[0])
	}
	pay.ValorCuotaPagada = money(d.Totals.TotalMinor)

	cliente, err := buildCliente(d.Customer)
	if err != nil {
		return nil, err
	}
	gov := cliente.TipoClienteFE == types.ClienteGobierno
	items := make([]types.Item, 0, len(d.Lines))
	var linesTotal int64
	for i, l := range d.Lines {
		class, ok := d.RateClasses[l.TaxRateBps]
		code, known := rateCodes[class]
		if !ok || !known {
			return nil, fmt.Errorf("%w: línea %d con tasa %d bps sin clase legal", domain.ErrInvalidRequest, i+1, l.TaxRateBps)
		}
		it := types.Item{
			Descripcion:    l.Description,
			Cantidad:       quantity(l.QuantityMilli),
			PrecioUnitario: money(l.UnitPriceMinor),
			PrecioItem:     money(l.BaseMinor),
			ValorTotal:     money(l.TotalMinor),
			TasaITBMS:      code,
			ValorITBMS:     money(l.TaxMinor),
		}
		if l.DiscountMinor > 0 {
			it.PrecioUnitarioDescuento = unitDiscount(l.DiscountMinor, l.QuantityMilli)
		}
		if c := strings.TrimSpace(l.CPBSCode); len(c) == 4 {
			it.CodigoCPBS, it.CodigoCPBSAbrev = c, c[:2]
			if gov {
				it.UnidadMedidaCPBS = l.UnitMeasureCode
			}
		}
		items = append(items, it)
		linesTotal += l.TotalMinor
	}

	dt := types.DatosTransaccion{
		TipoEmision:            types.EmisionAUPNormal,
		TipoDocumento:          docType(d.DocType),
		NumeroDocumentoFiscal:  hka.PadDocNumber(d.Number),
		PuntoFacturacionFiscal: d.PointOfSaleCode,
		FechaEmision:           hka.FormatDateTime(d.IssuedAt),
		NaturalezaOperacion:    types.NatVenta,
		TipoOperacion:          types.OperacionSalida,
		DestinoOperacion:       types.DestinoPanama,
		FormatoCAFE:            types.CAFEPapelCarta,
		EntregaCAFE:            types.EntregaElectronica,
		EnvioContenedor:        types.ContenedorNormal,
		ProcesoGeneracion:      "1",
		TipoVenta:              types.VentaGiroNegocio,
		Cliente:                cliente,
	}
	if d.DocType == domain.DocCreditNote {
		dt.NaturalezaOperacion = types.NatDevolucion
	}
	if d.DocType == domain.DocCreditNote || d.DocType == domain.DocDebitNote {
		if d.RelatedCUFE == "" {
			return nil, fmt.Errorf("%w: la nota no tiene el CUFE de la factura", domain.ErrInvalidRequest)
		}
		dt.ListaDocsFiscalReferenciados = []types.DocFiscalReferenciado{{
			FechaEmisionDocFiscalReferenciado: hka.FormatDateTime(d.RelatedIssuedAt), CufeFEReferenciada: d.RelatedCUFE}}
	}
	return &types.DocumentoElectronico{
		CodigoSucursalEmisor: d.BranchCode,
		DatosTransaccion:     dt,
		ListaItems:           items,
		TotalesSubTotales: types.TotalesSubTotales{
			TotalPrecioNeto:    money(d.Totals.SubtotalMinor),
			TotalITBMS:         money(d.Totals.TaxMinor),
			TotalMontoGravado:  money(d.Totals.TaxMinor),
			TotalFactura:       money(d.Totals.TotalMinor),
			TotalValorRecibido: money(d.Totals.TotalMinor),
			TiempoPago:         types.PagoInmediato,
			NroItems:           len(items),
			TotalTodosItems:    money(linesTotal),
			ListaFormaPago:     []types.FormaPagoItem{pay},
		},
	}, nil
}

// buildCliente traduce el receptor según su tipo de identificación (ADR 0022 §6).
func buildCliente(t *domain.Taxpayer) (types.Cliente, error) {
	c := types.Cliente{Pais: types.CountryPA}
	if t == nil {
		c.TipoClienteFE = types.ClienteConsumidorFinal
		return c, nil
	}
	c.RazonSocial, c.CorreoElectronico1 = t.LegalName, t.Email
	switch t.TaxIDType {
	case domain.TaxIDRUCJuridico, domain.TaxIDRUCNatural, domain.TaxIDGobierno:
		c.TipoClienteFE = types.ClienteContribuyente
		c.TipoContribuyente = types.ContribuyenteJuridico
		if t.TaxIDType == domain.TaxIDRUCNatural {
			c.TipoContribuyente = types.ContribuyenteNatural
		}
		if t.TaxIDType == domain.TaxIDGobierno {
			c.TipoClienteFE = types.ClienteGobierno
		}
		c.NumeroRUC, c.DigitoVerificadorRUC = t.TaxID, t.CheckDigit
		c.Direccion, c.CodigoUbicacion = t.Address, t.Location
	case domain.TaxIDCedula:
		c.TipoClienteFE = types.ClienteConsumidorFinal
		c.TipoContribuyente = types.ContribuyenteNatural
		c.NumeroRUC = t.TaxID
		c.Direccion, c.CodigoUbicacion = t.Address, t.Location
	case domain.TaxIDPasaporte, domain.TaxIDExtranjero:
		c.TipoClienteFE = types.ClienteExtranjero
		c.TipoIdentificacion = types.IdOtro
		if t.TaxIDType == domain.TaxIDPasaporte {
			c.TipoIdentificacion = types.IdPasaporte
		}
		c.NroIdentificacionExtranjero = t.TaxID
		c.Direccion = t.Address
	default:
		return c, fmt.Errorf("%w: tipo de identificación %q", domain.ErrInvalidTaxpayer, t.TaxIDType)
	}
	return c, nil
}

// money escribe centavos como balboas con dos decimales ("12.34").
func money(minor int64) string {
	sign := ""
	if minor < 0 {
		sign, minor = "-", -minor
	}
	return fmt.Sprintf("%s%d.%02d", sign, minor/100, minor%100)
}

// quantity escribe milésimas de unidad con tres decimales ("1.500").
func quantity(milli int64) string { return fmt.Sprintf("%d.%03d", milli/1000, milli%1000) }

// unitDiscount reparte el descuento de la línea por unidad, en millonésimas de balboa redondeadas
// half-up (seis decimales, el máximo que admite HKA). Se usa big.Int: centavos × 10⁷ no cabe en int64.
func unitDiscount(discountMinor, qtyMilli int64) string {
	num := new(big.Int).Mul(big.NewInt(discountMinor), big.NewInt(10_000*1000)) // centavos → 10⁻⁶ B/. × 1000
	den := big.NewInt(qtyMilli)
	q, r := new(big.Int).QuoRem(num, den, new(big.Int))
	if new(big.Int).Mul(r, big.NewInt(2)).Cmp(den) >= 0 {
		q.Add(q, big.NewInt(1))
	}
	micro := q.Int64()
	return fmt.Sprintf("%d.%06d", micro/1_000_000, micro%1_000_000)
}
