// Package hka es el adaptador de The Factory HKA (ADR 0022), por github.com/angelnereira/hka-sdk.
// Recibe el documento DGI ya armado por pac/dgi, lo convierte a los tipos del SDK y lo transporta. Es
// el único paquete que conoce a HKA: quitarlo o sumar otro PAC no toca el resto del servicio.
package hka

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	sdk "github.com/angelnereira/hka-sdk"
	"github.com/angelnereira/hka-sdk/types"
	"github.com/angelnereira/hka-sdk/validate"

	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/pac"
	"plentypay/fiscal-invoicing/internal/pac/dgi"
)

// ID es el identificador del adaptador en el perfil fiscal (pac_provider).
const ID = "hka"

// Claves del JSON de credenciales guardado en security (fiscal/<tenant>/pac).
const (
	KeyTokenEmpresa  = "token_empresa"
	KeyTokenPassword = "token_password"
)

// Endpoints publicados por The Factory HKA.
const (
	DemoEndpoint = sdk.DemoEndpoint
	ProdEndpoint = "https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc"
)

// Config del adaptador. ProdEnabled es el interruptor operativo FISCAL_PROD_ENABLED (F30.3).
type Config struct {
	DemoEndpoint string
	ProdEndpoint string
	Timeout      time.Duration
	ProdEnabled  bool
}

// Adapter implementa pac.Client y pac.FolioCounter.
type Adapter struct {
	demo        *sdk.Client
	prod        *sdk.Client
	prodEnabled bool
}

// New crea el adaptador. El SDK no reintenta: los reintentos son del worker (R3).
func New(cfg Config) *Adapter {
	if cfg.DemoEndpoint == "" {
		cfg.DemoEndpoint = DemoEndpoint
	}
	if cfg.ProdEndpoint == "" {
		cfg.ProdEndpoint = ProdEndpoint
	}
	return &Adapter{
		demo:        sdk.New(&sdk.Config{Endpoint: cfg.DemoEndpoint, Timeout: cfg.Timeout}),
		prod:        sdk.New(&sdk.Config{Endpoint: cfg.ProdEndpoint, Timeout: cfg.Timeout}),
		prodEnabled: cfg.ProdEnabled,
	}
}

// Info describe el adaptador para el selector.
func (a *Adapter) Info() pac.Info {
	envs := []string{domain.EnvDemo}
	if a.prodEnabled {
		envs = append(envs, domain.EnvProd)
	}
	return pac.Info{ID: ID, DisplayName: "The Factory HKA", Environments: envs, Credentials: []pac.CredentialField{
		{Key: KeyTokenEmpresa, Label: "Token de empresa"},
		{Key: KeyTokenPassword, Label: "Contraseña del token", Secret: true},
	}}
}

func (a *Adapter) client(env string) (*sdk.Client, error) {
	switch {
	case env == domain.EnvDemo:
		return a.demo, nil
	case env == domain.EnvProd && a.prodEnabled:
		return a.prod, nil
	}
	return nil, &pac.RetryError{Message: "la emisión en producción no está habilitada", Alert: true}
}

// Check arma el documento y aplica la validación previa del SDK, sin red.
func (a *Adapter) Check(d pac.Document) error {
	doc, err := build(d)
	if err != nil {
		return err
	}
	if ve := validate.Document(doc); ve != nil {
		return classify(ve)
	}
	return nil
}

// classify traduce los campos fallidos del SDK a errores de dominio.
func classify(ve *validate.ValidationError) error {
	for _, f := range ve.Fields {
		if strings.HasPrefix(f.Field, "Cliente.") {
			return fmt.Errorf("%w: %v", domain.ErrInvalidTaxpayer, ve)
		}
	}
	return fmt.Errorf("%w: %v", domain.ErrInvalidRequest, ve)
}

func credentials(c pac.Credentials) (sdk.Credentials, error) {
	out := sdk.Credentials{TokenEmpresa: c[KeyTokenEmpresa], TokenPassword: c[KeyTokenPassword]}
	if out.TokenEmpresa == "" || out.TokenPassword == "" {
		return out, &pac.RetryError{Message: "faltan las credenciales del PAC", Alert: true}
	}
	return out, nil
}

// Send transmite el documento y traduce la respuesta de HKA (ADR 0022 §10).
func (a *Adapter) Send(ctx context.Context, creds pac.Credentials, d pac.Document) (pac.Result, error) {
	cl, err := a.client(d.Environment)
	if err != nil {
		return pac.Result{}, err
	}
	hc, err := credentials(creds)
	if err != nil {
		return pac.Result{}, err
	}
	doc, err := build(d)
	if err != nil {
		return pac.Result{}, fmt.Errorf("%w: %v", pac.ErrInvalidDocument, err)
	}
	resp, err := cl.Send(ctx, hc, doc)
	if err == nil {
		if resp.Code.IsSuccess() && resp.CUFE != "" {
			return pac.Result{Accepted: true, CUFE: resp.CUFE, QR: resp.QR}, nil
		}
		return pac.Result{}, &pac.RetryError{Message: "el PAC pidió reenviar el documento", Err: fmt.Errorf("hka code %s", resp.Code)}
	}
	return translate(ctx, cl, hc, doc, err)
}

func translate(ctx context.Context, cl *sdk.Client, hc sdk.Credentials, doc *types.DocumentoElectronico, err error) (pac.Result, error) {
	var (
		ve *sdk.ValidationError
		he *sdk.HKAError
		ne *sdk.NetworkError
	)
	switch {
	case errors.As(err, &ve):
		return pac.Result{}, fmt.Errorf("%w: %v", pac.ErrInvalidDocument, ve)
	case errors.As(err, &ne):
		return pac.Result{}, &pac.RetryError{Message: "el PAC no respondió", Err: err}
	case errors.As(err, &he):
		switch he.Code {
		case types.CodeDuplicate:
			// Ya se había enviado (p. ej. el proceso cayó tras enviar): se recupera el CUFE.
			st, serr := cl.DocumentStatus(ctx, hc, documentKey(doc))
			if serr != nil || st.CUFE == "" {
				return pac.Result{}, &pac.RetryError{Message: "el PAC indica un documento duplicado; se consultará su estado", Err: errors.Join(err, serr)}
			}
			return pac.Result{Accepted: true, CUFE: st.CUFE}, nil
		case types.CodeInvalidData:
			return pac.Result{Accepted: false, RejectionReason: rejection(he.Message)}, nil
		case types.CodeNoFolios:
			return pac.Result{}, &pac.RetryError{Message: "la cuenta del PAC no tiene folios disponibles", Alert: true, Err: err}
		case types.CodeUnauthorized:
			return pac.Result{}, &pac.RetryError{Message: "el PAC rechazó las credenciales", Alert: true, Err: err}
		}
		return pac.Result{}, &pac.RetryError{Message: "el PAC respondió con un error", Alert: true, Err: err}
	}
	return pac.Result{}, &pac.RetryError{Message: "el PAC no respondió", Err: err}
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
func (a *Adapter) RemainingFolios(ctx context.Context, environment string, creds pac.Credentials) (int64, error) {
	cl, err := a.client(environment)
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

func documentKey(doc *types.DocumentoElectronico) sdk.DocumentKey {
	t := doc.DatosTransaccion
	return sdk.DocumentKey{CodigoSucursalEmisor: doc.CodigoSucursalEmisor, NumeroDocumentoFiscal: t.NumeroDocumentoFiscal,
		PuntoFacturacionFiscal: t.PuntoFacturacionFiscal, TipoDocumento: t.TipoDocumento, TipoEmision: t.TipoEmision}
}

// build arma el documento DGI neutral (pac/dgi) y lo pasa a los tipos del SDK de HKA.
func build(d pac.Document) (*types.DocumentoElectronico, error) {
	g, err := dgi.Build(d)
	if err != nil {
		return nil, err
	}
	return toHKA(g), nil
}

// toHKA es la única traducción específica de HKA: nombres de campo y valores fijos de su servicio
// (emisión normal, CAFE en papel carta entregado por correo, venta del giro del negocio).
func toHKA(g dgi.Document) *types.DocumentoElectronico {
	r := g.Receiver
	dt := types.DatosTransaccion{
		TipoEmision:            types.EmisionAUPNormal,
		TipoDocumento:          types.TipoDocumento(g.DocType),
		NumeroDocumentoFiscal:  g.Number,
		PuntoFacturacionFiscal: g.PointOfSale,
		FechaEmision:           sdk.FormatDateTime(g.IssuedAt),
		NaturalezaOperacion:    types.NaturalezaOperacion(g.Nature),
		TipoOperacion:          types.OperacionSalida,
		DestinoOperacion:       types.DestinoPanama,
		FormatoCAFE:            types.CAFEPapelCarta,
		EntregaCAFE:            types.EntregaElectronica,
		EnvioContenedor:        types.ContenedorNormal,
		ProcesoGeneracion:      "1",
		TipoVenta:              types.VentaGiroNegocio,
		Cliente: types.Cliente{
			TipoClienteFE: types.TipoClienteFE(r.Type), TipoContribuyente: types.TipoContribuyente(r.TaxpayerKind),
			NumeroRUC: r.RUC, DigitoVerificadorRUC: r.DV, RazonSocial: r.Name, Direccion: r.Address,
			CodigoUbicacion: r.Location, TipoIdentificacion: types.TipoIdentificacion(r.ForeignType),
			NroIdentificacionExtranjero: r.ForeignID, CorreoElectronico1: r.Email, Pais: types.CountryCode(r.Country),
		},
	}
	if g.Related != nil {
		dt.ListaDocsFiscalReferenciados = []types.DocFiscalReferenciado{{
			FechaEmisionDocFiscalReferenciado: sdk.FormatDateTime(g.Related.IssuedAt), CufeFEReferenciada: g.Related.CUFE}}
	}
	items := make([]types.Item, len(g.Items))
	for i, it := range g.Items {
		items[i] = types.Item{Descripcion: it.Description, Cantidad: it.Quantity, PrecioUnitario: it.UnitPrice,
			PrecioUnitarioDescuento: it.UnitDiscount, PrecioItem: it.Price, ValorTotal: it.Total,
			TasaITBMS: types.TasaITBMS(it.RateCode), ValorITBMS: it.Tax, CodigoCPBS: it.CPBS,
			CodigoCPBSAbrev: it.CPBSAbbrev, UnidadMedidaCPBS: it.CPBSUnit}
	}
	t := g.Totals
	return &types.DocumentoElectronico{
		CodigoSucursalEmisor: g.Branch,
		DatosTransaccion:     dt,
		ListaItems:           items,
		TotalesSubTotales: types.TotalesSubTotales{
			TotalPrecioNeto: t.Net, TotalITBMS: t.Tax, TotalMontoGravado: t.Taxed, TotalFactura: t.Total,
			TotalValorRecibido: t.Received, TiempoPago: types.PagoInmediato, NroItems: t.Items, TotalTodosItems: t.AllItems,
			ListaFormaPago: []types.FormaPagoItem{{FormaPagoFact: types.FormaPago(g.Payment.Code),
				DescFormaPago: g.Payment.Description, ValorCuotaPagada: g.Payment.Amount}},
		},
	}
}
