package service

import (
	"context"

	"plentypay/fiscal-invoicing/internal/domain"
)

type ProfileStore interface {
	Get(ctx context.Context, tenantID string) (domain.FiscalProfile, error)
	Upsert(ctx context.Context, p domain.FiscalProfile) error
}

type ProfileService struct {
	store ProfileStore
}

func NewProfileService(store ProfileStore) *ProfileService {
	return &ProfileService{store: store}
}

func (s *ProfileService) Get(ctx context.Context, tenantID string) (domain.FiscalProfile, error) {
	return s.store.Get(ctx, tenantID)
}

func (s *ProfileService) Upsert(ctx context.Context, p domain.FiscalProfile) error {
	if err := p.Validate(); err != nil {
		return err
	}
	return s.store.Upsert(ctx, p)
}
