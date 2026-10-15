package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"plentypay/security/internal/domain"
	"plentypay/security/internal/store"
)

func newTestService() (*SecurityService, *store.MemoryStore) {
	mem := store.NewMemoryStore("test-bootstrap-token")
	svc := NewSecurityService(mem, mem, mem, mem, mem)
	return svc, mem
}

// F05.2 / R2: Un contenedor no listado en allowed_readers recibe PERMISSION_DENIED.
func TestR2_SecretACL_EnforcesAllowedReaders(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	// Crear secreto con allowed_readers = ["fiscal-invoicing"]
	_, err := svc.PutSecret(ctx, "fiscal/tenant-1/pac", []byte("pac-token-secret"), nil, []string{"fiscal-invoicing"}, "k1", "platform")
	if err != nil {
		t.Fatalf("PutSecret: %v", err)
	}

	// 1. Contenedor no listado (ej: payments-core) intenta leer -> PERMISSION_DENIED
	_, err = svc.GetSecret(ctx, "fiscal/tenant-1/pac", "1", "payments-core")
	if !errors.Is(err, domain.ErrPermissionDenied) {
		t.Fatalf("esperaba ErrPermissionDenied, obtuve %v", err)
	}

	// 2. Contenedor listado (fiscal-invoicing) lee -> éxito
	sec, err := svc.GetSecret(ctx, "fiscal/tenant-1/pac", "1", "fiscal-invoicing")
	if err != nil {
		t.Fatalf("GetSecret autorizado falló: %v", err)
	}
	if string(sec.Value) != "pac-token-secret" {
		t.Fatalf("valor incorrecto: %s", string(sec.Value))
	}

	// 3. Plataforma (admin) puede leer siempre
	sec, err = svc.GetSecret(ctx, "fiscal/tenant-1/pac", "1", "platform")
	if err != nil {
		t.Fatalf("GetSecret platform falló: %v", err)
	}
	if string(sec.Value) != "pac-token-secret" {
		t.Fatalf("valor platform incorrecto: %s", string(sec.Value))
	}
}

// F05.2: Secretos no existentes devuelven ErrNotFound.
func TestR2_SecretNotFound(t *testing.T) {
	svc, _ := newTestService()
	_, err := svc.GetSecret(context.Background(), "no-existe", "", "fiscal-invoicing")
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("esperaba ErrNotFound, obtuve %v", err)
	}
}

// F05.3 / R3 & R7: Encrypt/Decrypt por propósito con AAD, y rotación de llaves manteniendo descifrado.
func TestR3_EncryptDecrypt_AADAndRotation(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	purpose := domain.PurposeNationalID
	plaintext := []byte("8-765-4321")
	canonicalAAD := []byte("tenant-001|user-123")
	wrongAAD := []byte("tenant-002|user-123")

	// 1. Cifrar con AAD canónico
	enc, err := svc.Encrypt(ctx, purpose, plaintext, canonicalAAD)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if enc.KeyVersion != "1" {
		t.Fatalf("versión inicial debe ser 1, obtuve %s", enc.KeyVersion)
	}

	// 2. Descifrar con AAD distinto falla (AAD_MISMATCH)
	_, err = svc.Decrypt(ctx, purpose, enc.Ciphertext, wrongAAD, enc.KeyVersion)
	if !errors.Is(err, domain.ErrAADMismatch) {
		t.Fatalf("esperaba ErrAADMismatch, obtuve %v", err)
	}

	// 3. Descifrar con AAD correcto tiene éxito
	decrypted, err := svc.Decrypt(ctx, purpose, enc.Ciphertext, canonicalAAD, enc.KeyVersion)
	if err != nil {
		t.Fatalf("Decrypt falló: %v", err)
	}
	if string(decrypted) != string(plaintext) {
		t.Fatalf("esperaba %s, obtuve %s", string(plaintext), string(decrypted))
	}

	// 4. Rotar la llave a versión 2 (R7)
	newVer, err := svc.RotateDataKey(ctx, purpose, "idem-rot-1")
	if err != nil {
		t.Fatalf("RotateDataKey: %v", err)
	}
	if newVer != "2" {
		t.Fatalf("nueva versión esperada 2, obtuve %s", newVer)
	}

	// 5. Cifrado con versión 1 se sigue pudiendo descifrar tras rotación (R7)
	decryptedOld, err := svc.Decrypt(ctx, purpose, enc.Ciphertext, canonicalAAD, "1")
	if err != nil {
		t.Fatalf("descifrado de versión antigua falló tras rotar llave: %v", err)
	}
	if string(decryptedOld) != string(plaintext) {
		t.Fatalf("datos de versión antigua no coinciden: %s", string(decryptedOld))
	}

	// 6. Nuevo cifrado usa versión 2
	enc2, err := svc.Encrypt(ctx, purpose, plaintext, canonicalAAD)
	if err != nil {
		t.Fatalf("Encrypt 2: %v", err)
	}
	if enc2.KeyVersion != "2" {
		t.Fatalf("nuevo cifrado debe usar versión 2, obtuve %s", enc2.KeyVersion)
	}

	// 7. Propósito desconocido falla
	_, err = svc.Encrypt(ctx, "proposito_invalido", plaintext, canonicalAAD)
	if !errors.Is(err, domain.ErrUnknownKeyPurpose) {
		t.Fatalf("esperaba ErrUnknownKeyPurpose, obtuve %v", err)
	}
}

// F05.4 / R4: Auditoría encadenada: alterar una fila rompe la cadena (VerifyAuditChain).
func TestR4_AuditHashChain_TamperDetection(t *testing.T) {
	svc, mem := newTestService()
	ctx := context.Background()

	// Crear 3 eventos encadenados
	ev1, err := svc.AppendAuditEvent(ctx, &domain.AuditEvent{
		EventID:     "ev-1",
		TenantID:    "t1",
		ActorUserID: "u1",
		Action:      "user.login",
		OccurredAt:  time.Now().UTC().Add(-10 * time.Minute),
	}, "k1")
	if err != nil {
		t.Fatal(err)
	}
	if len(ev1.Hash) == 0 {
		t.Fatal("el hash no debe estar vacío")
	}

	_, err = svc.AppendAuditEvent(ctx, &domain.AuditEvent{
		EventID:     "ev-2",
		TenantID:    "t1",
		ActorUserID: "u1",
		Action:      "payment.create",
		OccurredAt:  time.Now().UTC().Add(-5 * time.Minute),
	}, "k2")
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.AppendAuditEvent(ctx, &domain.AuditEvent{
		EventID:     "ev-3",
		TenantID:    "t1",
		ActorUserID: "u1",
		Action:      "payment.captured",
		OccurredAt:  time.Now().UTC(),
	}, "k3")
	if err != nil {
		t.Fatal(err)
	}

	// Cadena intacta inicialmente
	intact, brokenID, err := svc.VerifyAuditChain(ctx, time.Time{}, time.Time{})
	if err != nil || !intact || brokenID != "" {
		t.Fatalf("cadena inicial debe estar intacta: intact=%v broken=%s err=%v", intact, brokenID, err)
	}

	// Alterar la fila 1 (ev-2) directamente en la base de datos para simular manipulación
	mem.TamperEventForTesting(1, "payment.tampered_action")

	// Verificar que VerifyAuditChain detecta la alteración
	intact, brokenID, err = svc.VerifyAuditChain(ctx, time.Time{}, time.Time{})
	if err != nil {
		t.Fatalf("VerifyAuditChain no debe fallar con error: %v", err)
	}
	if intact {
		t.Fatal("la cadena alterada debió reportarse como intact=false")
	}
	if brokenID != "ev-2" {
		t.Fatalf("esperaba first_broken_event_id=ev-2, obtuve %s", brokenID)
	}
}

// F05.5 / R5: 20 fallos de login por IP en 10 min -> bloqueo de IP 1 h.
func TestR5_SecurityEvent_LoginFailedBlockThreshold(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	ip := "192.168.1.50"

	// 19 fallos de login -> no bloqueado
	for i := 1; i <= 19; i++ {
		blocked, err := svc.ReportSecurityEvent(ctx, domain.EventKindLoginFailed, "user-victim", ip, 1, nil, "")
		if err != nil {
			t.Fatal(err)
		}
		if blocked {
			t.Fatalf("intento %d no debería haber bloqueado todavía", i)
		}
	}

	// Comprobar IsBlocked aún en false
	isBlocked, _, _, err := svc.IsBlocked(ctx, "", ip)
	if err != nil || isBlocked {
		t.Fatalf("IP no debería estar bloqueada tras 19 intentos: %v", isBlocked)
	}

	// Intento número 20 -> se dispara bloqueo
	blocked, err := svc.ReportSecurityEvent(ctx, domain.EventKindLoginFailed, "user-victim", ip, 1, nil, "")
	if err != nil {
		t.Fatal(err)
	}
	if !blocked {
		t.Fatal("el intento 20 debió bloquear la IP")
	}

	// IsBlocked debe ser true con motivo LOGIN_FAILED
	isBlocked, reason, until, err := svc.IsBlocked(ctx, "", ip)
	if err != nil {
		t.Fatal(err)
	}
	if !isBlocked {
		t.Fatal("IsBlocked debió responder true para la IP bloqueada")
	}
	if reason != domain.EventKindLoginFailed {
		t.Fatalf("motivo esperado LOGIN_FAILED, obtuve %s", reason)
	}
	if until.Before(time.Now().UTC().Add(50 * time.Minute)) {
		t.Fatalf("bloqueo debe durar 1 hora, until=%v", until)
	}
}

// F05.5 / R5: TOKEN_REUSE bloquea la cuenta inmediatamente.
func TestR5_SecurityEvent_TokenReuseBlocksAccount(t *testing.T) {
	svc, _ := newTestService()
	ctx := context.Background()

	subject := "user-attacker-123"

	blocked, err := svc.ReportSecurityEvent(ctx, domain.EventKindTokenReuse, subject, "10.0.0.1", 3, nil, "")
	if err != nil {
		t.Fatal(err)
	}
	if !blocked {
		t.Fatal("TOKEN_REUSE debió bloquear la cuenta inmediatamente")
	}

	isBlocked, reason, _, err := svc.IsBlocked(ctx, subject, "")
	if err != nil || !isBlocked {
		t.Fatalf("cuenta debió estar bloqueada: %v", isBlocked)
	}
	if reason != domain.EventKindTokenReuse {
		t.Fatalf("motivo esperado TOKEN_REUSE, obtuve %s", reason)
	}
}
