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

	"plentypay/api-gateway/internal/pb"
)

// Route es una fila de la tabla declarativa.
type Route struct {
	// Method y Path son la ruta HTTP (Path con `{param}`).
	Method string
	Path   string
	// RPC es el método gRPC completo, p. ej. "/identity.Identity/GetTenant".
	RPC string
	// Permission exigida (vacía = ruta pública o solo autenticada).
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
}

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

	// Parámetros de ruta: /v1/business/{id} → campo id.
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

// Handler construye el http.Handler genérico de una ruta.
func Handler(conn *grpc.ClientConn, r Route) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
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

// TranslateError convierte un error gRPC en la respuesta del API (R8: sin
// filtrar mensajes internos).
func TranslateError(w http.ResponseWriter, err error) {
	st, ok := status.FromError(err)
	if !ok {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "error interno")
		return
	}
	switch st.Code() {
	case codes.InvalidArgument, codes.FailedPrecondition, codes.OutOfRange:
		writeError(w, http.StatusBadRequest, reasonOf(st), st.Message())
	case codes.Unauthenticated:
		writeError(w, http.StatusUnauthorized, reasonOf(st), "no autenticado")
	case codes.PermissionDenied:
		writeError(w, http.StatusForbidden, reasonOf(st), st.Message())
	case codes.NotFound:
		writeError(w, http.StatusNotFound, reasonOf(st), st.Message())
	case codes.AlreadyExists:
		writeError(w, http.StatusConflict, reasonOf(st), st.Message())
	case codes.Aborted:
		writeError(w, http.StatusConflict, reasonOf(st), "operación en curso, reintente")
	case codes.Unavailable:
		writeError(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "servicio no disponible")
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL", "error interno")
	}
}

func writeError(w http.ResponseWriter, status int, reason, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"reason": reason, "message": msg})
}

// setField fija un campo del proto por nombre, convirtiendo segun su tipo
// (string para rutas, int32 para page_size).
func setField(msg proto.Message, field, value string) error {
	m := msg.ProtoReflect()
	fd := m.Descriptor().Fields().ByName(protoreflect.Name(field))
	if fd == nil {
		return fmt.Errorf("campo %s no existe en %s", field, m.Descriptor().FullName())
	}
	switch fd.Kind() {
	case protoreflect.StringKind:
		m.Set(fd, protoreflect.ValueOfString(value))
	case protoreflect.Int32Kind, protoreflect.Int64Kind:
		n, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return fmt.Errorf("campo %s: %q no es un entero", field, value)
		}
		m.Set(fd, protoreflect.ValueOfInt64(n))
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

// reasonOf extrae el reason estable del ErrorInfo (grpc-conventions.md §4).
func reasonOf(st *status.Status) string {
	for _, d := range st.Details() {
		if info, ok := d.(*errdetails.ErrorInfo); ok && info.GetReason() != "" {
			return info.GetReason()
		}
	}
	return "INTERNAL"
}
