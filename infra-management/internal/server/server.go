package server

import (
	"context"
	"errors"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"plentypay/infra-management/internal/domain"
	"plentypay/infra-management/internal/pb"
	"plentypay/infra-management/internal/service"
)

type Server struct {
	pb.UnimplementedInfraManagementServer
	svc *service.InfraService
}

func NewServer(svc *service.InfraService) *Server {
	return &Server{svc: svc}
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
	case errors.Is(err, domain.ErrFlagNotFound):
		return statusWithReason(codes.NotFound, "FLAG_NOT_FOUND", "flag not found")
	case errors.Is(err, domain.ErrInvalidFlagRule):
		return statusWithReason(codes.InvalidArgument, "INVALID_FLAG_RULE", "invalid flag rule")
	case errors.Is(err, domain.ErrConfigNotFound):
		return statusWithReason(codes.NotFound, "CONFIG_NOT_FOUND", "config not found")
	case errors.Is(err, domain.ErrInvalidConfigValue):
		return statusWithReason(codes.InvalidArgument, "INVALID_CONFIG_VALUE", "invalid config value")
	case errors.Is(err, domain.ErrApprovalRequired):
		return statusWithReason(codes.PermissionDenied, "APPROVAL_REQUIRED", "approval required")
	case errors.Is(err, domain.ErrIdempotencyKeyReused):
		return statusWithReason(codes.AlreadyExists, "IDEMPOTENCY_KEY_REUSED", "idempotency key reused")
	default:
		return status.Errorf(codes.Internal, "internal error: %v", err)
	}
}

func (s *Server) EvaluateFlags(ctx context.Context, req *pb.EvaluateFlagsRequest) (*pb.EvaluateFlagsResponse, error) {
	var fCtx *domain.FlagContext
	if req.Context != nil {
		fCtx = &domain.FlagContext{
			TenantID:   req.Context.TenantId,
			UserID:     req.Context.UserId,
			Role:       req.Context.Role,
			AppVersion: req.Context.AppVersion,
			Platform:   req.Context.Platform,
		}
	}

	values, err := s.svc.EvaluateFlags(ctx, req.Keys, fCtx)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.EvaluateFlagsResponse{Values: values}, nil
}

func (s *Server) UpsertFlag(ctx context.Context, req *pb.UpsertFlagRequest) (*pb.Flag, error) {
	if req.Flag == nil || req.Flag.Key == "" {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "flag and key required")
	}

	f := &domain.Flag{
		Key:            req.Flag.Key,
		Description:    req.Flag.Description,
		Enabled:        req.Flag.Enabled,
		RolloutPercent: req.Flag.RolloutPercent,
		AllowTenants:   req.Flag.AllowTenants,
		AllowRoles:     req.Flag.AllowRoles,
		SafeDefault:    req.Flag.SafeDefault,
		UpdatedBy:      req.Flag.UpdatedBy,
	}

	saved, err := s.svc.UpsertFlag(ctx, f)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return toProtoFlag(saved), nil
}

func (s *Server) ListFlags(ctx context.Context, _ *pb.ListFlagsRequest) (*pb.ListFlagsResponse, error) {
	flags, err := s.svc.ListFlags(ctx)
	if err != nil {
		return nil, mapDomainError(err)
	}

	protoFlags := make([]*pb.Flag, 0, len(flags))
	for _, f := range flags {
		protoFlags = append(protoFlags, toProtoFlag(f))
	}

	return &pb.ListFlagsResponse{Flags: protoFlags}, nil
}

func (s *Server) GetConfig(ctx context.Context, req *pb.GetConfigRequest) (*pb.GetConfigResponse, error) {
	entries, err := s.svc.GetConfig(ctx, req.Keys, req.Scope)
	if err != nil {
		return nil, mapDomainError(err)
	}

	protoEntries := make([]*pb.ConfigEntry, 0, len(entries))
	for _, e := range entries {
		protoEntries = append(protoEntries, toProtoConfigEntry(e))
	}

	return &pb.GetConfigResponse{Entries: protoEntries}, nil
}

func (s *Server) SetConfig(ctx context.Context, req *pb.SetConfigRequest) (*pb.ConfigEntry, error) {
	if req.Entry == nil || req.Entry.Key == "" {
		return nil, statusWithReason(codes.InvalidArgument, "INVALID_ARGUMENT", "entry and key required")
	}

	e := &domain.ConfigEntry{
		Key:   req.Entry.Key,
		Value: req.Entry.Value,
		Scope: req.Entry.Scope,
	}

	saved, err := s.svc.SetConfig(ctx, e)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return toProtoConfigEntry(saved), nil
}

func (s *Server) SetMaintenanceMode(ctx context.Context, req *pb.SetMaintenanceModeRequest) (*pb.MaintenanceState, error) {
	state := &domain.MaintenanceState{
		Enabled: req.Enabled,
		Scope:   req.Scope,
		Message: req.Message,
	}
	if req.Until != nil {
		state.Until = req.Until.AsTime()
	}

	saved, err := s.svc.SetMaintenanceMode(ctx, state)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return toProtoMaintenanceState(saved), nil
}

func (s *Server) GetMaintenanceState(ctx context.Context, _ *pb.GetMaintenanceStateRequest) (*pb.MaintenanceState, error) {
	state, err := s.svc.GetMaintenanceState(ctx)
	if err != nil {
		return nil, mapDomainError(err)
	}
	return toProtoMaintenanceState(state), nil
}

func (s *Server) ListServices(ctx context.Context, _ *pb.ListServicesRequest) (*pb.ListServicesResponse, error) {
	svcs, err := s.svc.ListServices(ctx)
	if err != nil {
		return nil, mapDomainError(err)
	}

	protoSvcs := make([]*pb.ServiceInfo, 0, len(svcs))
	for _, si := range svcs {
		protoSvcs = append(protoSvcs, &pb.ServiceInfo{
			Name:      si.Name,
			Version:   si.Version,
			GitSha:    si.GitSHA,
			Status:    si.Status,
			Replicas:  si.Replicas,
			StartedAt: timestamppb.New(si.StartedAt),
		})
	}

	return &pb.ListServicesResponse{Services: protoSvcs}, nil
}

func (s *Server) GetClientConfig(ctx context.Context, req *pb.GetClientConfigRequest) (*pb.ClientConfig, error) {
	cfg, err := s.svc.GetClientConfig(ctx, req.Platform, req.AppVersion)
	if err != nil {
		return nil, mapDomainError(err)
	}

	return &pb.ClientConfig{
		MinimumAppVersion: cfg.MinimumAppVersion,
		UpdateRequired:    cfg.UpdateRequired,
		BannerMessage:     cfg.BannerMessage,
		Maintenance:       toProtoMaintenanceState(&cfg.Maintenance),
		LatestAppVersion:  cfg.LatestAppVersion,
		ApiBaseUrl:        cfg.ApiBaseUrl,
		RealtimeUrl:       cfg.RealtimeUrl,
		Features:          cfg.Features,
	}, nil
}

func toProtoFlag(f *domain.Flag) *pb.Flag {
	return &pb.Flag{
		Key:            f.Key,
		Description:    f.Description,
		Enabled:        f.Enabled,
		RolloutPercent: f.RolloutPercent,
		AllowTenants:   f.AllowTenants,
		AllowRoles:     f.AllowRoles,
		UpdatedAt:      timestamppb.New(f.UpdatedAt),
		UpdatedBy:      f.UpdatedBy,
		SafeDefault:    f.SafeDefault,
	}
}

func toProtoConfigEntry(e *domain.ConfigEntry) *pb.ConfigEntry {
	return &pb.ConfigEntry{
		Key:       e.Key,
		Value:     e.Value,
		Scope:     e.Scope,
		UpdatedAt: timestamppb.New(e.UpdatedAt),
	}
}

func toProtoMaintenanceState(m *domain.MaintenanceState) *pb.MaintenanceState {
	if m == nil {
		return &pb.MaintenanceState{}
	}
	res := &pb.MaintenanceState{
		Enabled: m.Enabled,
		Scope:   m.Scope,
		Message: m.Message,
	}
	if !m.Until.IsZero() {
		res.Until = timestamppb.New(m.Until)
	}
	return res
}
