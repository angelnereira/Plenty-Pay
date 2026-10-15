package server

import (
	"context"
	"encoding/hex"
	"errors"
	"time"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/security/internal/domain"
	"plentypay/security/internal/observability"
	"plentypay/security/internal/pb"
	"plentypay/security/internal/service"
	"plentypay/security/internal/store"
)

// Server implementa la API gRPC de pb.SecurityServer.
type Server struct {
	pb.UnimplementedSecurityServer
	svc      *service.SecurityService
	reporter *observability.Reporter
	metrics  *observability.Metrics
	now      func() time.Time
}

func NewServer(svc *service.SecurityService, reporter *observability.Reporter, metrics *observability.Metrics) *Server {
	return &Server{
		svc:      svc,
		reporter: reporter,
		metrics:  metrics,
		now:      time.Now,
	}
}

func extractCallerService(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	if vals := md.Get("x-pp-actor-service"); len(vals) > 0 && vals[0] != "" {
		return vals[0]
	}
	if vals := md.Get("x-pp-service"); len(vals) > 0 && vals[0] != "" {
		return vals[0]
	}
	return ""
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

func mapDomainError(err error) error {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return statusWithReason(codes.NotFound, "NOT_FOUND", "not found")
	case errors.Is(err, domain.ErrPermissionDenied):
		return statusWithReason(codes.PermissionDenied, "PERMISSION_DENIED", "permission denied")
	case errors.Is(err, domain.ErrUnknownKeyPurpose):
		return statusWithReason(codes.InvalidArgument, "UNKNOWN_KEY_PURPOSE", "unknown key purpose")
	case errors.Is(err, domain.ErrAADMismatch):
		return statusWithReason(codes.InvalidArgument, "AAD_MISMATCH", "associated data mismatch")
	case errors.Is(err, domain.ErrIdempotencyKeyReused):
		return statusWithReason(codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED", "idempotency key reused")
	case errors.Is(err, domain.ErrUnknownEventKind):
		return statusWithReason(codes.InvalidArgument, "UNKNOWN_EVENT_KIND", "unknown event kind")
	case errors.Is(err, domain.ErrBootstrapTokenInvalid):
		return statusWithReason(codes.Unauthenticated, "BOOTSTRAP_TOKEN_INVALID", "bootstrap token invalid")
	case errors.Is(err, domain.ErrAuditChainBroken):
		return statusWithReason(codes.DataLoss, "AUDIT_CHAIN_BROKEN", "audit chain broken")
	default:
		return status.Errorf(codes.Internal, "internal error")
	}
}

// --- Gestión de Secretos (SPEC §4) ---

func (s *Server) GetSecret(ctx context.Context, req *pb.GetSecretRequest) (*pb.Secret, error) {
	if req.Name == "" {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "name required")
	}

	callerService := extractCallerService(ctx)
	sec, err := s.svc.GetSecret(ctx, req.Name, req.Version, callerService)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.Secret{
		Name:    sec.Name,
		Version: sec.Version,
		Value:   sec.Value,
	}, nil
}

func (s *Server) PutSecret(ctx context.Context, req *pb.PutSecretRequest) (*pb.SecretMetadata, error) {
	if req.Name == "" || len(req.Value) == 0 {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "name and value required")
	}

	callerService := extractCallerService(ctx)
	meta, err := s.svc.PutSecret(ctx, req.Name, req.Value, req.Labels, req.AllowedReaders, req.IdempotencyKey, callerService)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.SecretMetadata{
		Name:           meta.Name,
		Version:        meta.Version,
		CreatedAt:      timestamppb.New(meta.CreatedAt),
		AllowedReaders: meta.AllowedReaders,
		Labels:         meta.Labels,
	}, nil
}

func (s *Server) RotateSecret(ctx context.Context, req *pb.RotateSecretRequest) (*pb.SecretMetadata, error) {
	if req.Name == "" || len(req.NewValue) == 0 {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "name and new_value required")
	}

	callerService := extractCallerService(ctx)
	meta, err := s.svc.RotateSecret(ctx, req.Name, req.NewValue, req.IdempotencyKey, callerService)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.SecretMetadata{
		Name:           meta.Name,
		Version:        meta.Version,
		CreatedAt:      timestamppb.New(meta.CreatedAt),
		AllowedReaders: meta.AllowedReaders,
		Labels:         meta.Labels,
	}, nil
}

func (s *Server) ListSecrets(ctx context.Context, req *pb.ListSecretsRequest) (*pb.ListSecretsResponse, error) {
	metas, err := s.svc.ListSecrets(ctx, req.NamePrefix)
	if err != nil {
		return nil, mapDomainError(err)
	}

	pbMetas := make([]*pb.SecretMetadata, 0, len(metas))
	for _, m := range metas {
		pbMetas = append(pbMetas, &pb.SecretMetadata{
			Name:           m.Name,
			Version:        m.Version,
			CreatedAt:      timestamppb.New(m.CreatedAt),
			AllowedReaders: m.AllowedReaders,
			Labels:         m.Labels,
		})
	}

	return &pb.ListSecretsResponse{Secrets: pbMetas}, nil
}

// --- Envelope Encryption (SPEC §4) ---

func (s *Server) Encrypt(ctx context.Context, req *pb.EncryptRequest) (*pb.EncryptResponse, error) {
	if req.KeyPurpose == "" || len(req.Plaintext) == 0 {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "key_purpose and plaintext required")
	}

	res, err := s.svc.Encrypt(ctx, req.KeyPurpose, req.Plaintext, req.AssociatedData)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.EncryptResponse{
		Ciphertext: res.Ciphertext,
		KeyVersion: res.KeyVersion,
	}, nil
}

func (s *Server) Decrypt(ctx context.Context, req *pb.DecryptRequest) (*pb.DecryptResponse, error) {
	if req.KeyPurpose == "" || len(req.Ciphertext) == 0 {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "key_purpose and ciphertext required")
	}

	plaintext, err := s.svc.Decrypt(ctx, req.KeyPurpose, req.Ciphertext, req.AssociatedData, req.KeyVersion)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.DecryptResponse{
		Plaintext: plaintext,
	}, nil
}

func (s *Server) RotateDataKey(ctx context.Context, req *pb.RotateDataKeyRequest) (*pb.RotateDataKeyResponse, error) {
	if req.KeyPurpose == "" {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "key_purpose required")
	}

	newVer, err := s.svc.RotateDataKey(ctx, req.KeyPurpose, req.IdempotencyKey)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.RotateDataKeyResponse{
		NewKeyVersion: newVer,
	}, nil
}

// --- Auditoría Encadenada (SPEC §4) ---

func (s *Server) AppendAuditEvent(ctx context.Context, req *pb.AppendAuditEventRequest) (*pb.AuditEvent, error) {
	if req.Event == nil {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "event required")
	}

	var prevHash []byte
	if req.Event.PrevHash != "" {
		prevHash, _ = hex.DecodeString(req.Event.PrevHash)
	}

	targetKind, targetID := "", ""
	if req.Event.Target != nil {
		targetKind = req.Event.Target.Type
		targetID = req.Event.Target.Id
	}

	occurredAt := time.Now().UTC()
	if req.Event.OccurredAt != nil {
		occurredAt = req.Event.OccurredAt.AsTime()
	}

	domEvent := &domain.AuditEvent{
		EventID:      req.Event.EventId,
		TenantID:     req.Event.TenantId,
		ActorUserID:  req.Event.ActorUserId,
		ActorRole:    req.Event.ActorRole,
		ActorService: req.Event.ActorService,
		Action:       req.Event.Action,
		TargetKind:   targetKind,
		TargetID:     targetID,
		Outcome:      req.Event.Outcome,
		IPAddress:    req.Event.IpAddress,
		RequestID:    req.Event.RequestId,
		Details:      req.Event.Details,
		PrevHash:     prevHash,
		OccurredAt:   occurredAt,
	}

	appended, err := s.svc.AppendAuditEvent(ctx, domEvent, req.IdempotencyKey)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.AuditEvent{
		EventId:      appended.EventID,
		TenantId:     appended.TenantID,
		ActorUserId:  appended.ActorUserID,
		ActorRole:    appended.ActorRole,
		Action:       appended.Action,
		Outcome:      appended.Outcome,
		IpAddress:    appended.IPAddress,
		RequestId:    appended.RequestID,
		Details:      appended.Details,
		PrevHash:     hex.EncodeToString(appended.PrevHash),
		Hash:         hex.EncodeToString(appended.Hash),
		OccurredAt:   timestamppb.New(appended.OccurredAt),
		ActorService: appended.ActorService,
	}, nil
}

func (s *Server) QueryAuditEvents(ctx context.Context, req *pb.QueryAuditEventsRequest) (*pb.QueryAuditEventsResponse, error) {
	filter := store.AuditFilter{
		TenantID:     req.TenantId,
		ActorUserID:  req.ActorUserId,
		ActionPrefix: req.ActionPrefix,
	}
	if req.Range != nil {
		if req.Range.From != nil {
			filter.From = req.Range.From.AsTime()
		}
		if req.Range.To != nil {
			filter.To = req.Range.To.AsTime()
		}
	}
	if req.Page != nil {
		filter.Limit = int(req.Page.PageSize)
	}

	events, _, err := s.svc.QueryAuditEvents(ctx, filter)
	if err != nil {
		return nil, mapDomainError(err)
	}

	pbEvents := make([]*pb.AuditEvent, 0, len(events))
	for _, e := range events {
		pbEvents = append(pbEvents, &pb.AuditEvent{
			EventId:      e.EventID,
			TenantId:     e.TenantID,
			ActorUserId:  e.ActorUserID,
			ActorRole:    e.ActorRole,
			Action:       e.Action,
			Outcome:      e.Outcome,
			IpAddress:    e.IPAddress,
			RequestId:    e.RequestID,
			Details:      e.Details,
			PrevHash:     hex.EncodeToString(e.PrevHash),
			Hash:         hex.EncodeToString(e.Hash),
			OccurredAt:   timestamppb.New(e.OccurredAt),
			ActorService: e.ActorService,
		})
	}

	return &pb.QueryAuditEventsResponse{Events: pbEvents}, nil
}

func (s *Server) VerifyAuditChain(ctx context.Context, req *pb.VerifyAuditChainRequest) (*pb.VerifyAuditChainResponse, error) {
	var from, to time.Time
	if req.Range != nil {
		if req.Range.From != nil {
			from = req.Range.From.AsTime()
		}
		if req.Range.To != nil {
			to = req.Range.To.AsTime()
		}
	}

	intact, brokenID, err := s.svc.VerifyAuditChain(ctx, from, to)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.VerifyAuditChainResponse{
		Intact:             intact,
		FirstBrokenEventId: brokenID,
	}, nil
}

// --- Eventos de Seguridad y Bloqueos (SPEC §4) ---

func (s *Server) ReportSecurityEvent(ctx context.Context, req *pb.ReportSecurityEventRequest) (*pb.ReportSecurityEventResponse, error) {
	if req.Kind == "" {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "kind required")
	}

	blocked, err := s.svc.ReportSecurityEvent(ctx, req.Kind, req.Subject, req.IpAddress, req.Severity, req.Details, req.IdempotencyKey)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.ReportSecurityEventResponse{
		Blocked: blocked,
	}, nil
}

func (s *Server) IsBlocked(ctx context.Context, req *pb.IsBlockedRequest) (*pb.IsBlockedResponse, error) {
	blocked, reason, until, err := s.svc.IsBlocked(ctx, req.Subject, req.IpAddress)
	if err != nil {
		return nil, mapDomainError(err)
	}

	var untilPb *timestamppb.Timestamp
	if !until.IsZero() {
		untilPb = timestamppb.New(until)
	}

	return &pb.IsBlockedResponse{
		Blocked: blocked,
		Reason:  reason,
		Until:   untilPb,
	}, nil
}

// --- Certificados de Servicio (SPEC §4) ---

func (s *Server) IssueServiceCertificate(ctx context.Context, req *pb.IssueServiceCertificateRequest) (*pb.ServiceCertificate, error) {
	if req.ServiceName == "" {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "service_name required")
	}

	cert, err := s.svc.IssueServiceCertificate(ctx, req.ServiceName, req.CsrPem, req.BootstrapToken, req.IdempotencyKey)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.ServiceCertificate{
		CertificatePem: cert.CertificatePEM,
		CaBundlePem:    cert.CABundlePEM,
		ExpiresAt:      timestamppb.New(cert.ExpiresAt),
	}, nil
}
