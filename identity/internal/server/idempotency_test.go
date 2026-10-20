package server

import (
	"context"
	"errors"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/identity/internal/pb"
	"plentypay/identity/internal/store"
	"plentypay/identity/internal/tenancy"
)

const (
	keyA      = "0b6f8f1e-0000-7000-8000-00000000000a"
	rpcBranch = "/plentypay.identity.v1.Identity/UpsertBranch"
)

// callWith ejecuta el interceptor con un handler que cuenta sus ejecuciones.
func callWith(t *testing.T, ic grpc.UnaryServerInterceptor, ctx context.Context, rpc string, req any, runs *int, fail error) (any, error) {
	t.Helper()
	return ic(ctx, req, &grpc.UnaryServerInfo{FullMethod: rpc}, func(context.Context, any) (any, error) {
		*runs++
		if fail != nil {
			return nil, fail
		}
		return &pb.Branch{BranchId: "b1", Version: int32(*runs)}, nil
	})
}

func branchReq(name, key string) *pb.UpsertBranchRequest {
	return &pb.UpsertBranchRequest{Branch: &pb.Branch{Code: "0001", Name: name}, IdempotencyKey: key}
}

// §3: misma clave + mismo contenido → la respuesta original, sin ejecutar de nuevo.
func TestObs_IdempotentReplayReturnsOriginalResponse(t *testing.T) {
	ic := IdempotencyInterceptor(store.NewInMemoryIdempotencyStore(), nil)
	ctx := tenancy.WithTenant(context.Background(), "tenant-1")
	runs := 0
	first, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", keyA), &runs, nil)
	if err != nil {
		t.Fatal(err)
	}
	again, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", keyA), &runs, nil)
	if err != nil || runs != 1 {
		t.Fatalf("el reintento no ejecuta de nuevo: runs=%d err=%v", runs, err)
	}
	if again.(*pb.Branch).GetVersion() != first.(*pb.Branch).GetVersion() {
		t.Fatalf("respuesta distinta: %+v vs %+v", again, first)
	}
}

// §3: misma clave + otro contenido → ALREADY_EXISTS con IDEMPOTENCY_KEY_REUSED.
func TestObs_IdempotencyKeyReusedWithOtherRequest(t *testing.T) {
	ic := IdempotencyInterceptor(store.NewInMemoryIdempotencyStore(), nil)
	ctx := tenancy.WithTenant(context.Background(), "tenant-1")
	runs := 0
	if _, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", keyA), &runs, nil); err != nil {
		t.Fatal(err)
	}
	_, err := callWith(t, ic, ctx, rpcBranch, branchReq("David", keyA), &runs, nil)
	if code, reason := reasonOf(t, err); code != codes.AlreadyExists || reason != "IDEMPOTENCY_KEY_REUSED" || runs != 1 {
		t.Fatalf("clave reutilizada → %v/%s runs=%d", code, reason, runs)
	}
}

// §3: reintento mientras la primera sigue en curso → ABORTED (el cliente reintenta con backoff).
func TestObs_IdempotencyInProgressIsAborted(t *testing.T) {
	st := store.NewInMemoryIdempotencyStore()
	ic := IdempotencyInterceptor(st, nil)
	ctx := tenancy.WithTenant(context.Background(), "tenant-1")
	_, hash, err := idempotencyKeyOf(branchReq("Colón", keyA))
	if err != nil {
		t.Fatal(err)
	}
	if rec, err := st.Reserve(ctx, "tenant-1", rpcBranch, keyA, hash); err != nil || rec != nil {
		t.Fatalf("reserva previa: %v %+v", err, rec)
	}
	runs := 0
	_, err = callWith(t, ic, ctx, rpcBranch, branchReq("Colón", keyA), &runs, nil)
	if status.Code(err) != codes.Aborted || runs != 0 {
		t.Fatalf("en curso → %v runs=%d", err, runs)
	}
}

// Una ejecución que falla libera la clave: el reintento vuelve a ejecutar (no hubo mutación).
func TestObs_IdempotencyFailureReleasesKey(t *testing.T) {
	ic := IdempotencyInterceptor(store.NewInMemoryIdempotencyStore(), nil)
	ctx := tenancy.WithTenant(context.Background(), "tenant-1")
	runs := 0
	if _, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", keyA), &runs, errors.New("rechazo")); err == nil {
		t.Fatal("se esperaba el error del handler")
	}
	if _, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", keyA), &runs, nil); err != nil || runs != 2 {
		t.Fatalf("el reintento ejecuta: runs=%d err=%v", runs, err)
	}
}

// La clave es única por (tenant, RPC): otro negocio con la misma clave ejecuta lo suyo.
func TestObs_IdempotencyScopedByTenantAndRPC(t *testing.T) {
	ic := IdempotencyInterceptor(store.NewInMemoryIdempotencyStore(), nil)
	runs := 0
	for _, tenant := range []string{"tenant-1", "tenant-2"} {
		if _, err := callWith(t, ic, tenancy.WithTenant(context.Background(), tenant), rpcBranch, branchReq("Colón", keyA), &runs, nil); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := callWith(t, ic, tenancy.WithTenant(context.Background(), "tenant-1"), "/plentypay.identity.v1.Identity/DeactivateBranch",
		&pb.BranchRef{BranchId: "b1", IdempotencyKey: keyA}, &runs, nil); err != nil {
		t.Fatal(err)
	}
	if runs != 3 {
		t.Fatalf("cada (tenant, RPC) ejecuta una vez: runs=%d", runs)
	}
}

// Clave fuera de 16–100 caracteres → INVALID_ARGUMENT; sin clave o en RPC con tokens → pasa directo.
func TestObs_IdempotencyKeyValidationAndExclusions(t *testing.T) {
	ic := IdempotencyInterceptor(store.NewInMemoryIdempotencyStore(), nil)
	ctx := tenancy.WithTenant(context.Background(), "tenant-1")
	runs := 0
	_, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", "corta"), &runs, nil)
	if code, reason := reasonOf(t, err); code != codes.InvalidArgument || reason != "INVALID_REQUEST" || runs != 0 {
		t.Fatalf("clave corta → %v/%s", code, reason)
	}
	for i := 0; i < 2; i++ {
		if _, err := callWith(t, ic, ctx, rpcBranch, branchReq("Colón", ""), &runs, nil); err != nil {
			t.Fatal(err)
		}
		accept := &pb.AcceptInvitationRequest{InvitationToken: "t", IdempotencyKey: keyA}
		if _, err := callWith(t, ic, ctx, "/plentypay.identity.v1.Identity/AcceptInvitation", accept, &runs, nil); err != nil {
			t.Fatal(err)
		}
	}
	if runs != 4 {
		t.Fatalf("sin clave y AcceptInvitation no se repiten desde el store: runs=%d", runs)
	}
}
