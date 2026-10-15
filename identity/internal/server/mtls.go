package server

import (
	"context"
	"crypto/x509"
	"strings"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

// AllowedIdentityCallers lista los contenedores autorizados para invocar RPCs síncronos
// de identity según la matriz de docs/architecture/service-dependencies.md §3.
var AllowedIdentityCallers = map[string]bool{
	"api-gateway":   true,
	"payments-core": true,
	"settlement":    true,
	"orders":        true,
	"logistics":     true,
	"payroll":       true,
	"notifications": true,
}

// ExtractSPIFFEService extrae el nombre de servicio del SAN URI SPIFFE (spiffe://plentypay/<service>)
// presente en el certificado del cliente. Devuelve "" si no hay certificado o no es SPIFFE.
func ExtractSPIFFEService(ctx context.Context) (string, error) {
	p, ok := peer.FromContext(ctx)
	if !ok || p.AuthInfo == nil {
		return "", statusWithReason(codes.Unauthenticated, "UNAUTHENTICATED", "missing client certificate")
	}

	tlsInfo, ok := p.AuthInfo.(credentials.TLSInfo)
	if !ok || len(tlsInfo.State.PeerCertificates) == 0 {
		return "", statusWithReason(codes.Unauthenticated, "UNAUTHENTICATED", "missing client certificate")
	}

	cert := tlsInfo.State.PeerCertificates[0]
	return ParseSPIFFEService(cert)
}

// ParseSPIFFEService extrae el nombre del servicio desde un certificado x509 analizando sus URIs.
func ParseSPIFFEService(cert *x509.Certificate) (string, error) {
	for _, u := range cert.URIs {
		if u.Scheme == "spiffe" && u.Host == "plentypay" {
			svc := strings.Trim(u.Path, "/")
			if svc != "" {
				return svc, nil
			}
		}
	}
	return "", statusWithReason(codes.Unauthenticated, "UNAUTHENTICATED", "no valid SPIFFE identity in client certificate")
}

// SPIFFEServerInterceptor aplica la autenticación mTLS y autorización de llamada según SPIFFE (ADR 0011).
// Si enforce=true y no se presenta un certificado válido con identidad autorizada, rechaza con UNAUTHENTICATED
// o PERMISSION_DENIED.
func SPIFFEServerInterceptor(enforce bool, allowedCallers map[string]bool) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		svc, err := ExtractSPIFFEService(ctx)
		if err != nil {
			if enforce {
				return nil, err
			}
			// Si no se exige mTLS (desarrollo local / red privada sin TLS), continúa
			return handler(ctx, req)
		}

		if len(allowedCallers) > 0 && !allowedCallers[svc] {
			return nil, statusWithReason(codes.PermissionDenied, "PERMISSION_DENIED", "service caller not allowed")
		}

		return handler(ctx, req)
	}
}

func statusWithReason(c codes.Code, reason, msg string) error {
	st := status.New(c, msg)
	ds, err := st.WithDetails(&errdetails.ErrorInfo{
		Reason: reason,
		Domain: "plentypay",
	})
	if err == nil {
		return ds.Err()
	}
	return st.Err()
}
