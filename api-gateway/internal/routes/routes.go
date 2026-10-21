// Package routes tiene la tabla declarativa de rutas del gateway
// (api-gateway/SPEC.md §4) y el traductor genérico JSON↔proto. Una ruta nueva
// es una fila: no hace falta escribir un handler por endpoint (F09.3).
//
// Convenios de la tabla (SPEC §4): `{id}` = UUIDv7; las mutaciones de dinero o
// de estado exigen `Idempotency-Key`; 🔒 = requiere step-up.
package routes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	"plentypay/api-gateway/internal/metadata"
	"plentypay/api-gateway/internal/pb"
)

// Route es una fila de la tabla declarativa.
type Route struct {
	// Method y Path son la ruta HTTP (Path con `{param}`).
	Method string
	Path   string
	// RPC es el método gRPC completo, p. ej. "/identity.Identity/GetTenant".
	RPC string
	// Permission exigida (vacía = ruta pública o solo autenticada). "a|b" acepta cualquiera de las
	// dos, cuando el servicio admite más de un permiso para la misma lectura.
	Permission string
	// RequireAuth indica si la ruta necesita token.
	RequireAuth bool
	// Idempotency exige cabecera Idempotency-Key (grpc-conventions.md §3).
	Idempotency bool
	// StepUp exige X-Step-Up-Token (SPEC §4, 🔒).
	StepUp bool
	// NewRequest fabrica el mensaje proto del request (nil = sin cuerpo).
	NewRequest func() proto.Message
	// NewResponse fabrica el mensaje proto de la respuesta del RPC.
	NewResponse func() proto.Message
	// PathParams mapea parámetros de ruta a campos del proto.
	PathParams map[string]string
	// QueryParams mapea query strings a campos del proto.
	QueryParams map[string]string
	// RawBody indica que el cuerpo viaja tal cual (webhooks, R9).
	RawBody bool
	// Backend es el contenedor destino (vacío = identity). Ver Backend* abajo.
	Backend string
	// Defaults fija campos constantes del proto (ruta → `account.type`), antes del query.
	Defaults map[string]string
	// FromCaller fija campos del proto con la identidad validada (`user_id`, `tenant_id`), al
	// final: nunca los decide el cliente (R5, ADR 0011).
	FromCaller map[string]string
}

// Contenedores destino de la tabla (service-dependencies.md §3).
const (
	BackendIdentity   = ""
	BackendPayments   = "payments-core"
	BackendLedger     = "ledger"
	BackendCatalog    = "catalog"
	BackendInventory  = "inventory"
	BackendPos        = "pos"
	BackendOrders     = "orders"
	BackendFiscal     = "fiscal-invoicing"
	BackendSettlement = "settlement"
)

// FullMethod devuelve el método gRPC normalizado (con barra inicial).
func (r Route) FullMethod() string {
	if strings.HasPrefix(r.RPC, "/") {
		return r.RPC
	}
	return "/" + r.RPC
}

// ── Traductor JSON↔proto ──────────────────────────────────────────────────────

var errNoBody = errors.New("ruta sin cuerpo")

// DecodeRequest construye el mensaje proto de la ruta a partir de la petición
// HTTP: cuerpo JSON (protojson), parámetros de ruta y query.
func (r Route) DecodeRequest(req *http.Request) (proto.Message, error) {
	if r.NewRequest == nil {
		return nil, errNoBody
	}
	msg := r.NewRequest()

	if req.Body != nil && req.ContentLength != 0 {
		body, err := readAll(req)
		if err != nil {
			return nil, err
		}
		if len(strings.TrimSpace(string(body))) > 0 {
			if err := (protojson.UnmarshalOptions{DiscardUnknown: false}).Unmarshal(body, msg); err != nil {
				return nil, fmt.Errorf("json inválido: %w", err)
			}
		}
	}

	// Ruta y query DESPUÉS del cuerpo: protojson reinicia el mensaje al decodificar, y el recurso
	// lo identifica el path (un `user_id` del cuerpo nunca reemplaza al de la ruta).
	if len(r.PathParams) > 0 {
		values := PathValues(r.Path, req.URL.Path)
		for name, field := range r.PathParams {
			if v, ok := values[name]; ok {
				if err := setField(msg, field, v); err != nil {
					return nil, fmt.Errorf("parámetro %s: %w", name, err)
				}
			}
		}
	}

	for field, value := range r.Defaults {
		if err := setField(msg, field, value); err != nil {
			return nil, err
		}
	}

	// Query: listas con page_size/page_token.
	if len(r.QueryParams) > 0 {
		q := req.URL.Query()
		for name, field := range r.QueryParams {
			if v := q.Get(name); v != "" {
				if err := setField(msg, field, v); err != nil {
					return nil, fmt.Errorf("query %s: %w", name, err)
				}
			}
		}
	}

	if len(r.FromCaller) > 0 {
		c := metadata.FromContext(req.Context())
		for field, attr := range r.FromCaller {
			var v string
			switch attr {
			case "user_id":
				v = c.UserID
			case "tenant_id":
				v = c.TenantID
			default:
				return nil, fmt.Errorf("atributo de caller %q desconocido", attr)
			}
			if err := setField(msg, field, v); err != nil {
				return nil, err
			}
		}
	}

	// Idempotencia al final: protojson resetea el mensaje, así que la cabecera se
	// copia después de decodificar el cuerpo (grpc-conventions.md §3).
	if r.Idempotency {
		if key := IdempotencyKey(req); key != "" {
			if err := setField(msg, "idempotency_key", key); err != nil {
				return nil, err
			}
		}
	}
	return msg, nil
}

func readAll(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return nil, nil
	}
	defer func() { _ = req.Body.Close() }()
	return io.ReadAll(req.Body)
}

// EncodeResponse serializa el mensaje proto como JSON de la API (nombres
// snake_case, como el contrato con Flutter).
func EncodeResponse(msg proto.Message) ([]byte, error) {
	return (protojson.MarshalOptions{
		UseProtoNames:   true,
		EmitUnpopulated: true,
	}).Marshal(msg)
}

// Invoke llama al RPC de forma genérica (los metadatos viajan en el contexto).
// La respuesta se fabrica con NewResponse: casi nunca coincide con el request.
func Invoke(ctx context.Context, conn *grpc.ClientConn, r Route, req proto.Message) (proto.Message, error) {
	resp := r.newResponse()
	if err := conn.Invoke(ctx, r.FullMethod(), req, resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// newResponse devuelve el mensaje de respuesta de la ruta.
func (r Route) newResponse() proto.Message {
	if r.NewResponse != nil {
		return r.NewResponse()
	}
	if r.NewRequest != nil {
		return r.NewRequest()
	}
	return &pb.SimpleResult{}
}

// HasPermission dice si la sesión tiene el permiso de la ruta (o alguno de "a|b").
func HasPermission(have []string, want string) bool {
	for _, p := range strings.Split(want, "|") {
		if slices.Contains(have, p) {
			return true
		}
	}
	return false
}

// Handler construye el http.Handler genérico de una ruta.
func Handler(conn *grpc.ClientConn, r Route) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		// Primera barrera (SPEC §3.8): permiso de la ruta contra el permiso efectivo de la sesión.
		// El servicio vuelve a verificar (security-standards.md §3, defensa en profundidad).
		if r.Permission != "" && !HasPermission(metadata.FromContext(req.Context()).Permissions, r.Permission) {
			writeError(w, http.StatusForbidden, "PERMISSION_DENIED", "no tienes permiso para esta operación")
			return
		}
		var in proto.Message
		if r.NewRequest != nil {
			var err error
			if in, err = r.DecodeRequest(req); err != nil {
				writeError(w, http.StatusBadRequest, "INVALID_JSON", "cuerpo inválido")
				return
			}
		}
		out, err := Invoke(req.Context(), conn, r, in)
		if err != nil {
			TranslateError(w, err)
			return
		}
		body, err := EncodeResponse(out)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "error interno")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}
}

// TranslateError convierte un error gRPC en la respuesta del API siguiendo la
// tabla de grpc-conventions.md §4 (R8: nunca filtra el detalle interno; INTERNAL
// responde genérico).
func TranslateError(w http.ResponseWriter, err error) {
	st, ok := status.FromError(err)
	if !ok {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "error interno")
		return
	}
	reason := reasonOf(st)
	switch st.Code() {
	case codes.InvalidArgument, codes.OutOfRange:
		writeError(w, http.StatusBadRequest, reason, st.Message())
	case codes.FailedPrecondition:
		// Regla de negocio o transicion invalida: el reason estable viaja tal cual.
		writeError(w, http.StatusConflict, reason, st.Message())
	case codes.Unauthenticated:
		writeError(w, http.StatusUnauthorized, reason, "no autenticado")
	case codes.PermissionDenied:
		writeError(w, http.StatusForbidden, reason, st.Message())
	case codes.NotFound:
		// No se revela si el recurso existe pero es de otro tenant.
		writeError(w, http.StatusNotFound, reason, st.Message())
	case codes.AlreadyExists:
		writeError(w, http.StatusConflict, reason, st.Message())
	case codes.Aborted:
		// Conflicto de concurrencia: el cliente reintenta.
		w.Header().Set("Retry-After", "1")
		writeError(w, http.StatusConflict, reason, "operacion en curso, reintente")
	case codes.ResourceExhausted:
		w.Header().Set("Retry-After", retryAfter(st))
		writeError(w, http.StatusTooManyRequests, reason, st.Message())
	case codes.Unavailable:
		writeError(w, http.StatusServiceUnavailable, reason, "servicio no disponible")
	case codes.DeadlineExceeded:
		writeError(w, http.StatusGatewayTimeout, reason, "el servicio no respondio a tiempo")
	case codes.Unimplemented:
		writeError(w, http.StatusNotImplemented, reason, "operacion no implementada")
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL", "error interno")
	}
}

// retryAfter lee los segundos de reintento de los metadatos del estado.
func retryAfter(st *status.Status) string {
	for _, d := range st.Details() {
		if ri, ok := d.(*errdetails.RetryInfo); ok && ri.GetRetryDelay() != nil {
			return fmt.Sprintf("%d", int(ri.GetRetryDelay().AsDuration().Seconds()))
		}
	}
	return "1"
}

func writeError(w http.ResponseWriter, status int, reason, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"reason": reason, "message": msg})
}

// setField fija un campo del proto por nombre, convirtiendo segun su tipo
// (string para rutas, int32 para page_size). Acepta rutas con punto hacia mensajes
// anidados (`page.page_size`, `amount.amount_minor`), enums por nombre o número y
// `google.protobuf.Timestamp` en RFC 3339.
func setField(msg proto.Message, field, value string) error {
	m := msg.ProtoReflect()
	parts := strings.Split(field, ".")
	for _, name := range parts[:len(parts)-1] {
		fd := m.Descriptor().Fields().ByName(protoreflect.Name(name))
		if fd == nil || fd.Kind() != protoreflect.MessageKind || fd.IsList() || fd.IsMap() {
			return fmt.Errorf("campo %s no existe en %s", field, msg.ProtoReflect().Descriptor().FullName())
		}
		m = m.Mutable(fd).Message()
	}
	field = parts[len(parts)-1]
	fd := m.Descriptor().Fields().ByName(protoreflect.Name(field))
	if fd == nil {
		return fmt.Errorf("campo %s no existe en %s", field, m.Descriptor().FullName())
	}
	switch fd.Kind() {
	case protoreflect.EnumKind:
		if ev := fd.Enum().Values().ByName(protoreflect.Name(value)); ev != nil {
			m.Set(fd, protoreflect.ValueOfEnum(ev.Number()))
			return nil
		}
		n, err := strconv.ParseInt(value, 10, 32)
		if err != nil || fd.Enum().Values().ByNumber(protoreflect.EnumNumber(n)) == nil {
			return fmt.Errorf("campo %s: %q no es un valor válido", field, value)
		}
		m.Set(fd, protoreflect.ValueOfEnum(protoreflect.EnumNumber(n)))
		return nil
	case protoreflect.MessageKind:
		if fd.Message().FullName() != "google.protobuf.Timestamp" {
			return fmt.Errorf("campo %s: tipo %s no soportado", field, fd.Message().FullName())
		}
		t, err := time.Parse(time.RFC3339, value)
		if err != nil {
			return fmt.Errorf("campo %s: %q no es una fecha RFC 3339", field, value)
		}
		ts := m.Mutable(fd).Message()
		ts.Set(ts.Descriptor().Fields().ByName("seconds"), protoreflect.ValueOfInt64(t.Unix()))
		ts.Set(ts.Descriptor().Fields().ByName("nanos"), protoreflect.ValueOfInt32(int32(t.Nanosecond())))
		return nil
	}
	switch fd.Kind() {
	case protoreflect.StringKind:
		m.Set(fd, protoreflect.ValueOfString(value))
	case protoreflect.Int32Kind:
		n, err := strconv.ParseInt(value, 10, 32)
		if err != nil {
			return fmt.Errorf("campo %s: %q no es un entero", field, value)
		}
		m.Set(fd, protoreflect.ValueOfInt32(int32(n)))
	case protoreflect.Int64Kind:
		n, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return fmt.Errorf("campo %s: %q no es un entero", field, value)
		}
		m.Set(fd, protoreflect.ValueOfInt64(n))
	case protoreflect.BoolKind:
		b, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("campo %s: %q no es booleano", field, value)
		}
		m.Set(fd, protoreflect.ValueOfBool(b))
	default:
		return fmt.Errorf("campo %s: tipo %s no soportado", field, fd.Kind())
	}
	return nil
}

// PathValues extrae los valores de una ruta con `{param}`.
func PathValues(pattern, path string) map[string]string {
	out := map[string]string{}
	pp := strings.Split(strings.Trim(pattern, "/"), "/")
	sp := strings.Split(strings.Trim(path, "/"), "/")
	if len(pp) != len(sp) {
		return out
	}
	for i, seg := range pp {
		if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
			out[strings.Trim(seg, "{}")] = sp[i]
		}
	}
	return out
}

// IdempotencyKey lee la cabecera estándar (grpc-conventions.md §3).
func IdempotencyKey(r *http.Request) string {
	return strings.TrimSpace(r.Header.Get("Idempotency-Key"))
}

// Timestamp es un helper para las pruebas (protojson usa RFC3339).
func Timestamp(t time.Time) string { return t.UTC().Format(time.RFC3339) }

// reasonOf extrae el reason estable del ErrorInfo (grpc-conventions.md §4). Si el
// servicio no lo envio, se usa el reason canonico del codigo para que el cliente
// siempre tenga algo que traducir.
func reasonOf(st *status.Status) string {
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok && info.GetReason() != "" {
			return info.GetReason()
		}
	}
	if canonical, ok := canonicalReason[st.Code()]; ok {
		return canonical
	}
	return "INTERNAL"
}

// canonicalReason es el reason por defecto de cada codigo de la tabla §4.
var canonicalReason = map[codes.Code]string{
	codes.InvalidArgument:    "INVALID_ARGUMENT",
	codes.OutOfRange:         "INVALID_ARGUMENT",
	codes.Unauthenticated:    "UNAUTHENTICATED",
	codes.PermissionDenied:   "PERMISSION_DENIED",
	codes.NotFound:           "NOT_FOUND",
	codes.FailedPrecondition: "FAILED_PRECONDITION",
	codes.AlreadyExists:      "ALREADY_EXISTS",
	codes.Aborted:            "ABORTED",
	codes.ResourceExhausted:  "RATE_LIMITED",
	codes.Unavailable:        "SERVICE_UNAVAILABLE",
	codes.DeadlineExceeded:   "DEADLINE_EXCEEDED",
	codes.Unimplemented:      "UNIMPLEMENTED",
	codes.Internal:           "INTERNAL",
}
