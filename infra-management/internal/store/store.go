package store

import (
	"context"

	"plentypay/infra-management/internal/domain"
)

type ChangeEvent struct {
	Type   string // "flag" | "config" | "maintenance"
	Key    string
	Action string // "upsert" | "delete"
}

type Store interface {
	GetFlag(ctx context.Context, key string) (*domain.Flag, error)
	UpsertFlag(ctx context.Context, flag *domain.Flag) error
	ListFlags(ctx context.Context) ([]*domain.Flag, error)

	GetConfig(ctx context.Context, keys []string, scope string) ([]*domain.ConfigEntry, error)
	SetConfig(ctx context.Context, entry *domain.ConfigEntry) error

	SetMaintenance(ctx context.Context, state *domain.MaintenanceState) error
	GetMaintenance(ctx context.Context) (*domain.MaintenanceState, error)

	Subscribe(ctx context.Context) (<-chan ChangeEvent, func())
}
