package server

import (
	"context"
	"testing"
	"time"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"plentypay/security/internal/domain"
	"plentypay/security/internal/pb"
	"plentypay/security/internal/service"
	"plentypay/security/internal/store"
)

func newTestServer() (*Server, *store.MemoryStore) {
	mem := store.NewMemoryStore("dev-bootstrap-token")
	svc := service.NewSecurityService(mem, mem, mem, mem, mem)
	srv := NewServer(svc, nil, nil)
	return srv, mem
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

// F05.2 Criterio de aceptación: Contenedor no listado -> PERMISSION_DENIED.
func TestServer_GetSecret_ACL(t *testing.T) {
	srv, _ := newTestServer()
	ctx := context.Background()

	// Crear secreto con allowed_readers = ["identity"]
	_, err := srv.PutSecret(ctx, &pb.PutSecretRequest{
		Name:           "jwt/key",
		Value:          []byte("super-secret-jwt-key"),
		AllowedReaders: []string{"identity"},
		IdempotencyKey: "put-1",
	})
	if err != nil {
		t.Fatalf("PutSecret: %v", err)
	}

	// 1. Llamada sin metadatos de llamador o con servicio no permitido (payments-core) -> PERMISSION_DENIED
	callerCtx := metadata.NewIncomingContext(ctx, metadata.Pairs("x-pp-actor-service", "payments-core"))
	_, err = srv.GetSecret(callerCtx, &pb.GetSecretRequest{Name: "jwt/key"})
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("esperaba status code PermissionDenied, obtuve %v", err)
	}
	if reason := extractReason(err); reason != "PERMISSION_DENIED" {
		t.Fatalf("esperaba reason PERMISSION_DENIED, obtuve %q", reason)
	}

	// 2. Llamada de servicio permitido (identity) -> éxito
	authCtx := metadata.NewIncomingContext(ctx, metadata.Pairs("x-pp-actor-service", "identity"))
	sec, err := srv.GetSecret(authCtx, &pb.GetSecretRequest{Name: "jwt/key"})
	if err != nil {
		t.Fatalf("GetSecret autorizado falló: %v", err)
	}
	if string(sec.Value) != "super-secret-jwt-key" {
		t.Fatalf("valor no coincide: %s", string(sec.Value))
	}
}

// F05.2: Secret inexistente -> NOT_FOUND.
func TestServer_GetSecret_NotFound(t *testing.T) {
	srv, _ := newTestServer()
	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-pp-actor-service", "identity"))
	_, err := srv.GetSecret(ctx, &pb.GetSecretRequest{Name: "no-existe"})
	if status.Code(err) != codes.NotFound {
		t.Fatalf("esperaba NotFound, obtuve %v", err)
	}
	if reason := extractReason(err); reason != "NOT_FOUND" {
		t.Fatalf("esperaba reason NOT_FOUND, obtuve %q", reason)
	}
}

// F05.3 Criterio de aceptación: AAD distinto falla; rotación mantiene descifrado.
func TestServer_EncryptDecrypt_AADMismatchAndRotation(t *testing.T) {
	srv, _ := newTestServer()
	ctx := context.Background()

	plaintext := []byte("secret-tax-id-12345")
	canonicalAAD := []byte("tenant-001|business-456")
	wrongAAD := []byte("tenant-999|business-456")

	// 1. Encrypt con AAD canónico
	enc, err := srv.Encrypt(ctx, &pb.EncryptRequest{
		KeyPurpose:     domain.PurposeTaxID,
		Plaintext:      plaintext,
		AssociatedData: canonicalAAD,
	})
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if enc.KeyVersion != "1" {
		t.Fatalf("versión inicial esperada 1, obtuve %s", enc.KeyVersion)
	}

	// 2. Decrypt con AAD distinto falla con AAD_MISMATCH
	_, err = srv.Decrypt(ctx, &pb.DecryptRequest{
		KeyPurpose:     domain.PurposeTaxID,
		Ciphertext:     enc.Ciphertext,
		AssociatedData: wrongAAD,
		KeyVersion:     enc.KeyVersion,
	})
	if status.Code(err) != codes.InvalidArgument {
		t.Fatalf("esperaba InvalidArgument, obtuve %v", err)
	}
	if reason := extractReason(err); reason != "AAD_MISMATCH" {
		t.Fatalf("esperaba reason AAD_MISMATCH, obtuve %q", reason)
	}

	// 3. Decrypt con AAD correcto
	dec, err := srv.Decrypt(ctx, &pb.DecryptRequest{
		KeyPurpose:     domain.PurposeTaxID,
		Ciphertext:     enc.Ciphertext,
		AssociatedData: canonicalAAD,
		KeyVersion:     enc.KeyVersion,
	})
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if string(dec.Plaintext) != string(plaintext) {
		t.Fatalf("esperaba %s, obtuve %s", string(plaintext), string(dec.Plaintext))
	}

	// 4. Rotar llave a versión 2
	rot, err := srv.RotateDataKey(ctx, &pb.RotateDataKeyRequest{
		KeyPurpose:     domain.PurposeTaxID,
		IdempotencyKey: "rot-key-1",
	})
	if err != nil {
		t.Fatalf("RotateDataKey: %v", err)
	}
	if rot.NewKeyVersion != "2" {
		t.Fatalf("nueva versión esperada 2, obtuve %s", rot.NewKeyVersion)
	}

	// 5. Descifrado de versión 1 se mantiene tras rotación
	decOld, err := srv.Decrypt(ctx, &pb.DecryptRequest{
		KeyPurpose:     domain.PurposeTaxID,
		Ciphertext:     enc.Ciphertext,
		AssociatedData: canonicalAAD,
		KeyVersion:     "1",
	})
	if err != nil {
		t.Fatalf("descifrado versión antigua falló: %v", err)
	}
	if string(decOld.Plaintext) != string(plaintext) {
		t.Fatalf("datos descifrados no coinciden: %s", string(decOld.Plaintext))
	}
}

// F05.4 Criterio de aceptación: Alterar una fila rompe la cadena (prueba).
func TestServer_AuditChain_TamperDetection(t *testing.T) {
	srv, mem := newTestServer()
	ctx := context.Background()

	// Append 2 eventos
	_, err := srv.AppendAuditEvent(ctx, &pb.AppendAuditEventRequest{
		Event: &pb.AuditEvent{
			EventId:  "ev-1",
			TenantId: "t1",
			Action:   "tenant.created",
		},
		IdempotencyKey: "k1",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = srv.AppendAuditEvent(ctx, &pb.AppendAuditEventRequest{
		Event: &pb.AuditEvent{
			EventId:  "ev-2",
			TenantId: "t1",
			Action:   "payout.initiated",
		},
		IdempotencyKey: "k2",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Cadena intacta
	verifyResp, err := srv.VerifyAuditChain(ctx, &pb.VerifyAuditChainRequest{})
	if err != nil || !verifyResp.Intact {
		t.Fatalf("cadena debe estar intacta inicialmente: %v", verifyResp)
	}

	// Alterar fila en la base de datos
	mem.TamperEventForTesting(0, "tenant.tampered")

	// Verificar detección de ruptura
	verifyResp, err = srv.VerifyAuditChain(ctx, &pb.VerifyAuditChainRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if verifyResp.Intact {
		t.Fatal("cadena alterada debió reportarse como Intact=false")
	}
	if verifyResp.FirstBrokenEventId != "ev-1" {
		t.Fatalf("esperaba FirstBrokenEventId=ev-1, obtuve %s", verifyResp.FirstBrokenEventId)
	}
}

// F05.5 Criterio de aceptación: 20 fallos de login por IP -> bloqueo.
func TestServer_ReportSecurityEvent_BlockThreshold(t *testing.T) {
	srv, _ := newTestServer()
	ctx := context.Background()
	ip := "203.0.113.195"

	for i := 1; i <= 19; i++ {
		resp, err := srv.ReportSecurityEvent(ctx, &pb.ReportSecurityEventRequest{
			Kind:      domain.EventKindLoginFailed,
			IpAddress: ip,
		})
		if err != nil {
			t.Fatal(err)
		}
		if resp.Blocked {
			t.Fatalf("intento %d no debía bloquear aún", i)
		}
	}

	resp, err := srv.ReportSecurityEvent(ctx, &pb.ReportSecurityEventRequest{
		Kind:      domain.EventKindLoginFailed,
		IpAddress: ip,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !resp.Blocked {
		t.Fatal("intento 20 debió bloquear la IP")
	}

	chk, err := srv.IsBlocked(ctx, &pb.IsBlockedRequest{IpAddress: ip})
	if err != nil {
		t.Fatal(err)
	}
	if !chk.Blocked || chk.Reason != domain.EventKindLoginFailed {
		t.Fatalf("esperaba Blocked=true, Reason=LOGIN_FAILED, obtuve %+v", chk)
	}
}

// F05.6: IssueServiceCertificate valida token de bootstrap.
func TestServer_IssueServiceCertificate(t *testing.T) {
	srv, _ := newTestServer()
	ctx := context.Background()

	// Token inválido -> UNAUTHENTICATED con BOOTSTRAP_TOKEN_INVALID
	_, err := srv.IssueServiceCertificate(ctx, &pb.IssueServiceCertificateRequest{
		ServiceName:    "identity",
		BootstrapToken: "token-invalido",
	})
	if status.Code(err) != codes.Unauthenticated {
		t.Fatalf("esperaba Unauthenticated, obtuve %v", err)
	}
	if reason := extractReason(err); reason != "BOOTSTRAP_TOKEN_INVALID" {
		t.Fatalf("esperaba reason BOOTSTRAP_TOKEN_INVALID, obtuve %q", reason)
	}

	// Token correcto -> emitido con 24h
	cert, err := srv.IssueServiceCertificate(ctx, &pb.IssueServiceCertificateRequest{
		ServiceName:    "identity",
		BootstrapToken: "dev-bootstrap-token",
	})
	if err != nil {
		t.Fatalf("emisión de certificado falló: %v", err)
	}
	if len(cert.CertificatePem) == 0 || len(cert.CaBundlePem) == 0 {
		t.Fatal("PEM no debe estar vacío")
	}
	if cert.ExpiresAt.AsTime().Before(time.Now().Add(23 * time.Hour)) {
		t.Fatalf("expiración debe ser a 24 horas: %v", cert.ExpiresAt.AsTime())
	}
}
