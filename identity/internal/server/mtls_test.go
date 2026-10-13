package server

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"net/url"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

func mockPeerContext(serviceName string, isSPIFFE bool) context.Context {
	uris := []*url.URL{}
	if isSPIFFE {
		u, _ := url.Parse("spiffe://plentypay/" + serviceName)
		uris = append(uris, u)
	} else if serviceName != "" {
		u, _ := url.Parse("https://example.com/" + serviceName)
		uris = append(uris, u)
	}

	cert := &x509.Certificate{
		Subject: pkix.Name{CommonName: serviceName},
		URIs:    uris,
	}

	tlsInfo := credentials.TLSInfo{
		State: tls.ConnectionState{
			PeerCertificates: []*x509.Certificate{cert},
		},
	}

	p := &peer.Peer{
		AuthInfo: tlsInfo,
	}
	return peer.NewContext(context.Background(), p)
}

func extractReason(err error) string {
	st, ok := status.FromError(err)
	if !ok {
		return ""
	}
	for _, detail := range st.Details() {
		if ei, ok := detail.(*errdetails.ErrorInfo); ok {
			return ei.Reason
		}
	}
	return ""
}

func dummyHandler(ctx context.Context, req any) (any, error) {
	return "ok", nil
}

func TestSPIFFE_MissingCertificateWhenEnforced(t *testing.T) {
	interceptor := SPIFFEServerInterceptor(true, AllowedIdentityCallers)
	_, err := interceptor(context.Background(), nil, &grpc.UnaryServerInfo{}, dummyHandler)
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("esperaba Unauthenticated, obtuve %v", err)
	}
	if reason := extractReason(err); reason != "UNAUTHENTICATED" {
		t.Fatalf("esperaba reason UNAUTHENTICATED, obtuve %q", reason)
	}
}

func TestSPIFFE_AllowedCallerSucceeds(t *testing.T) {
	interceptor := SPIFFEServerInterceptor(true, AllowedIdentityCallers)

	for _, caller := range []string{"api-gateway", "payments-core", "settlement", "orders", "logistics", "payroll", "notifications"} {
		ctx := mockPeerContext(caller, true)
		resp, err := interceptor(ctx, nil, &grpc.UnaryServerInfo{}, dummyHandler)
		if err != nil {
			t.Fatalf("llamador permitido %q falló: %v", caller, err)
		}
		if resp != "ok" {
			t.Fatalf("respuesta inesperada: %v", resp)
		}
	}
}

func TestSPIFFE_UnauthorizedCallerFails(t *testing.T) {
	interceptor := SPIFFEServerInterceptor(true, AllowedIdentityCallers)

	// 'web' o 'catalog' no pueden llamar directamente a identity según service-dependencies.md §3
	for _, caller := range []string{"web", "catalog", "inventory", "unknown-service"} {
		ctx := mockPeerContext(caller, true)
		_, err := interceptor(ctx, nil, &grpc.UnaryServerInfo{}, dummyHandler)
		if status.Code(err) != codes.PermissionDenied {
			t.Fatalf("esperaba PermissionDenied para %q, obtuve %v", caller, err)
		}
		if reason := extractReason(err); reason != "PERMISSION_DENIED" {
			t.Fatalf("esperaba reason PERMISSION_DENIED, obtuve %q", reason)
		}
	}
}

func TestSPIFFE_NoSPIFFEInCertificate(t *testing.T) {
	interceptor := SPIFFEServerInterceptor(true, AllowedIdentityCallers)
	ctx := mockPeerContext("api-gateway", false) // no es URI spiffe://plentypay/
	_, err := interceptor(ctx, nil, &grpc.UnaryServerInfo{}, dummyHandler)
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("esperaba Unauthenticated, obtuve %v", err)
	}
	if reason := extractReason(err); reason != "UNAUTHENTICATED" {
		t.Fatalf("esperaba reason UNAUTHENTICATED, obtuve %q", reason)
	}
}

func TestSPIFFE_NotEnforcedAllowsUnauthenticated(t *testing.T) {
	interceptor := SPIFFEServerInterceptor(false, AllowedIdentityCallers)
	resp, err := interceptor(context.Background(), nil, &grpc.UnaryServerInfo{}, dummyHandler)
	if err != nil {
		t.Fatalf("con enforce=false no debe fallar sin certificado: %v", err)
	}
	if resp != "ok" {
		t.Fatalf("esperaba ok, obtuve %v", resp)
	}
}
