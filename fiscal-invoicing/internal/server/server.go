// Package server es el adaptador gRPC de fiscal-invoicing: traduce pb ↔ service y los errores del
// dominio a código gRPC + `reason` (grpc-conventions.md §4). No contiene reglas de negocio.
package server

import (
	"context"
	"errors"
	"strings"

	errdetails "google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"plentypay/fiscal-invoicing/internal/client"
	"plentypay/fiscal-invoicing/internal/domain"
	"plentypay/fiscal-invoicing/internal/observability"
	"plentypay/fiscal-invoicing/internal/pb"
	"plentypay/fiscal-invoicing/internal/service"
)

// ErrorInfo construye un error con `reason` estable (grpc-conventions.md §4).
func ErrorInfo(code codes.Code, reason, message string) error {
	st := status.New(code, message)
	if d, err := st.WithDetails(&errdetails.ErrorInfo{Reason: reason, Domain: "plentypay"}); err == nil {
		return d.Err()
	}
	return st.Err()
}

var errorTable = []struct {
	err    error
	code   codes.Code
	reason string
}{
	{domain.ErrNoTenant, codes.PermissionDenied, "PERMISSION_DENIED"},
	{domain.ErrPermissionDenied, codes.PermissionDenied, "PERMISSION_DENIED"},
	{domain.ErrStepUpRequired, codes.PermissionDenied, "STEP_UP_REQUIRED"},
	{domain.ErrStepUpInvalid, codes.PermissionDenied, "STEP_UP_INVALID"},
	{domain.ErrNotFound, codes.NotFound, "NOT_FOUND"},
	{domain.ErrProfileMissing, codes.FailedPrecondition, "PROFILE_MISSING"},
	{domain.ErrInvalidRUC, codes.InvalidArgument, "INVALID_RUC"},
	{domain.ErrInvalidTaxpayer, codes.InvalidArgument, "INVALID_TAXPAYER"},
	{domain.ErrTotalsMismatch, codes.InvalidArgument, "TOTALS_MISMATCH"},
	{domain.ErrInvalidTaxRate, codes.InvalidArgument, "INVALID_TAX_RATE"},
	{domain.ErrPacNotConfigured, codes.FailedPrecondition, "PAC_NOT_CONFIGURED"},
	{domain.ErrInvalidRequest, codes.InvalidArgument, "INVALID_REQUEST"},
	{domain.ErrIdempotencyReused, codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED"},
	{domain.ErrDependency, codes.Unavailable, "DEPENDENCY_UNAVAILABLE"},
	{client.ErrUnavailable, codes.Unavailable, "DEPENDENCY_UNAVAILABLE"},
}

// toStatus: lo que no es un rechazo esperable es un defecto; viaja como INTERNAL y el interceptor
// lo registra una vez y lo oculta al cliente (AGENTS.md §2.15).
func toStatus(err error) error {
	for _, e := range errorTable {
		if errors.Is(err, e.err) {
			return ErrorInfo(e.code, e.reason, e.err.Error())
		}
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return status.Error(codes.DeadlineExceeded, "tiempo agotado")
	}
	return status.Error(codes.Internal, observability.Wrap(err, "fiscal-invoicing").Error())
}

// Server implementa pb.FiscalInvoicingServer.
type Server struct {
	pb.UnimplementedFiscalInvoicingServer
	svc *service.Invoicing
}

// New arma el adaptador.
func New(svc *service.Invoicing) *Server { return &Server{svc: svc} }

func profileToPB(p domain.Profile) *pb.FiscalProfile {
	out := &pb.FiscalProfile{
		TenantId: p.TenantID, Environment: p.Environment, CredentialsSecretRef: p.PACCredentialsSecret,
		CertificateSecretRef: p.CertificateSecretRef, CheckoutPreference: pb.CheckoutPreference(p.CheckoutPreference),
		BranchCode: p.BranchCode, PointOfSaleCode: p.PointOfSaleCode, PacProvider: p.PACProvider,
	}
	if p.AutoThresholdMinor != nil {
		out.AutoThresholdMinor = *p.AutoThresholdMinor
	}
	return out
}

func taxpayerToPB(t domain.Taxpayer) *pb.Taxpayer {
	return &pb.Taxpayer{TaxpayerId: t.ID, TaxId: t.TaxID, TaxIdType: t.TaxIDType, CheckDigit: t.CheckDigit,
		LegalName: t.LegalName, Email: t.Email}
}

// ConfigureFiscalProfile guarda el perfil (step-up `security.credentials.update`; credenciales a security).
func (s *Server) ConfigureFiscalProfile(ctx context.Context, req *pb.ConfigureFiscalProfileRequest) (*pb.FiscalProfile, error) {
	p := req.GetProfile()
	if p == nil {
		return nil, toStatus(domain.ErrInvalidRequest)
	}
	var threshold *int64
	if p.GetCheckoutPreference() == pb.CheckoutPreference_CHECKOUT_PREFERENCE_AUTO_THRESHOLD {
		v := p.GetAutoThresholdMinor()
		threshold = &v
	}
	out, err := s.svc.ConfigureProfile(ctx, service.ConfigureInput{
		Environment: strings.ToUpper(strings.TrimSpace(p.GetEnvironment())), CheckoutPreference: int(p.GetCheckoutPreference()),
		AutoThresholdMinor: threshold, BranchCode: p.GetBranchCode(), PointOfSaleCode: p.GetPointOfSaleCode(),
		PACProvider: p.GetPacProvider(), PACCredentials: req.GetPacCredentials(), StepUpToken: req.GetStepUpToken(),
		IdempotencyKey: req.GetIdempotencyKey(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return profileToPB(out), nil
}

// GetFiscalProfile devuelve el perfil del negocio.
func (s *Server) GetFiscalProfile(ctx context.Context, _ *pb.GetFiscalProfileRequest) (*pb.FiscalProfile, error) {
	p, err := s.svc.GetProfile(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	return profileToPB(p), nil
}

// GetFolioStatus devuelve los folios restantes (-1 = sin tope contratado).
func (s *Server) GetFolioStatus(ctx context.Context, _ *pb.GetFolioStatusRequest) (*pb.FolioStatus, error) {
	st, err := s.svc.FolioStatus(ctx)
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.FolioStatus{Remaining: st.Remaining}
	if st.Last != nil {
		out.LowWatermark = max(*st.Last/10, 1) // SPEC §4: FolioLow si quedan < 10 %
	}
	return out, nil
}

// EvaluateDocumentPolicy decide factura o recibo interno (domain-model §8.8).
func (s *Server) EvaluateDocumentPolicy(ctx context.Context, req *pb.EvaluateDocumentPolicyRequest) (*pb.DocumentPolicyDecision, error) {
	d, err := s.svc.EvaluatePolicy(ctx, req.GetTotal().GetAmountMinor(), req.GetCustomerRequestsFiscal(), req.GetCustomerHasTaxId())
	if err != nil {
		return nil, toStatus(err)
	}
	return &pb.DocumentPolicyDecision{DocumentType: pb.DocumentType(d.DocType),
		AppliedPreference: pb.CheckoutPreference(d.AppliedPreference), NeedsCustomerConfirmation: d.NeedsCustomerDecision}, nil
}

// UpsertTaxpayer guarda un contribuyente frecuente.
func (s *Server) UpsertTaxpayer(ctx context.Context, req *pb.UpsertTaxpayerRequest) (*pb.Taxpayer, error) {
	t := req.GetTaxpayer()
	if t == nil {
		return nil, toStatus(domain.ErrInvalidRequest)
	}
	out, err := s.svc.UpsertTaxpayer(ctx, domain.Taxpayer{TaxIDType: t.GetTaxIdType(), TaxID: t.GetTaxId(),
		CheckDigit: t.GetCheckDigit(), LegalName: t.GetLegalName(), Email: t.GetEmail()})
	if err != nil {
		return nil, toStatus(err)
	}
	return taxpayerToPB(out), nil
}

// SearchTaxpayers busca contribuyentes frecuentes.
func (s *Server) SearchTaxpayers(ctx context.Context, req *pb.SearchTaxpayersRequest) (*pb.SearchTaxpayersResponse, error) {
	list, next, err := s.svc.SearchTaxpayers(ctx, req.GetQuery(), int(req.GetPage().GetPageSize()), req.GetPage().GetPageToken())
	if err != nil {
		return nil, toStatus(err)
	}
	out := &pb.SearchTaxpayersResponse{Page: &pb.PageInfo{NextPageToken: next}}
	for _, t := range list {
		out.Taxpayers = append(out.Taxpayers, taxpayerToPB(t))
	}
	return out, nil
}
