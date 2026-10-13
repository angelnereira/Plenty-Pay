package store

import (
	"context"
	"strings"
	"sync"
	"time"

	"plentypay/infra-management/internal/domain"
)

type MemoryStore struct {
	mu          sync.RWMutex
	flags       map[string]*domain.Flag
	configs     map[string]*domain.ConfigEntry // "scope:key" -> ConfigEntry
	schemas     map[string]domain.ConfigValidator
	maintenance *domain.MaintenanceState
	subs        map[chan ChangeEvent]struct{}
	changes     []ChangeEvent
}

func NewMemoryStore() *MemoryStore {
	m := &MemoryStore{
		flags:   make(map[string]*domain.Flag),
		configs: make(map[string]*domain.ConfigEntry),
		schemas: make(map[string]domain.ConfigValidator),
		subs:    make(map[chan ChangeEvent]struct{}),
		changes: make([]ChangeEvent, 0),
		maintenance: &domain.MaintenanceState{
			Enabled: false,
			Scope:   "global",
			Message: "",
		},
	}

	m.initDefaults()
	return m
}

func (m *MemoryStore) initDefaults() {
	now := time.Now().UTC()

	// Flags iniciales obligatorios (SPEC §5 R2)
	initialFlags := []*domain.Flag{
		{Key: "rail.yappy.enabled", Description: "Habilita pagos vía Yappy", Enabled: true, RolloutPercent: 100, SafeDefault: true, UpdatedAt: now},
		{Key: "rail.ach.enabled", Description: "Habilita pagos vía ACH Xpress", Enabled: true, RolloutPercent: 100, SafeDefault: true, UpdatedAt: now},
		{Key: "payments.enabled", Description: "Cobros habilitados en la plataforma", Enabled: true, RolloutPercent: 100, SafeDefault: true, UpdatedAt: now},
		{Key: "marketplace.enabled", Description: "Módulo de marketplace activo", Enabled: true, RolloutPercent: 100, SafeDefault: true, UpdatedAt: now},
		{Key: "pos.offline.enabled", Description: "Soporte de ventas offline en cajas POS", Enabled: true, RolloutPercent: 100, SafeDefault: true, UpdatedAt: now},
		{Key: "analytics.ask.enabled", Description: "Consultas analíticas en lenguaje natural", Enabled: false, RolloutPercent: 0, SafeDefault: false, UpdatedAt: now},
		{Key: "signup.business.enabled", Description: "Registro autoservicio de comercios", Enabled: true, RolloutPercent: 100, SafeDefault: true, UpdatedAt: now},
	}
	for _, f := range initialFlags {
		m.flags[f.Key] = f
	}

	// Esquemas de validación de configuración (SPEC §4 y §5 R3)
	intPositive := int64(1)
	intZero := int64(0)
	intMaxITBMS := int64(10000) // 100% en bps

	m.schemas["limits.payment.max_minor"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intPositive}
	m.schemas["limits.wallet.max_balance_minor"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intPositive}
	m.schemas["stepup.threshold_minor"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intZero}
	m.schemas["holidays.pa"] = &domain.SimpleTypeValidator{ExpectedType: "json_array"}
	m.schemas["legal.pa.itbms.standard_bps"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intZero, MaxInt: &intMaxITBMS}
	m.schemas["legal.pa.itbms.alcohol_bps"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intZero, MaxInt: &intMaxITBMS}
	m.schemas["legal.pa.itbms.tobacco_bps"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intZero, MaxInt: &intMaxITBMS}
	m.schemas["legal.pa.wallet.monthly_inflow_max_minor"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intPositive}
	m.schemas["ratelimits.global.rps"] = &domain.SimpleTypeValidator{ExpectedType: "integer", MinInt: &intPositive}

	// Configs iniciales (SPEC §5 R3 y parámetros legales de Panamá)
	initialConfigs := []struct {
		key, value, scope string
	}{
		{"limits.payment.max_minor", "1000000", "global"},
		{"limits.wallet.max_balance_minor", "500000", "global"},
		{"stepup.threshold_minor", "10000", "global"},
		{"holidays.pa", `["2026-01-01","2026-01-09","2026-02-17","2026-05-01","2026-11-03","2026-11-04","2026-11-05","2026-11-10","2026-11-28","2026-12-08","2026-12-25"]`, "global"},
		{"legal.pa.itbms.standard_bps", "700", "global"},
		{"legal.pa.itbms.alcohol_bps", "1000", "global"},
		{"legal.pa.itbms.tobacco_bps", "1500", "global"},
		{"legal.pa.wallet.monthly_inflow_max_minor", "500000", "global"},
		{"ratelimits.global.rps", "100", "global"},
	}

	for _, c := range initialConfigs {
		m.configs[c.scope+":"+c.key] = &domain.ConfigEntry{
			Key:       c.key,
			Value:     c.value,
			Scope:     c.scope,
			UpdatedAt: now,
		}
	}
}

func (m *MemoryStore) GetFlag(_ context.Context, key string) (*domain.Flag, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	f, ok := m.flags[key]
	if !ok {
		return nil, domain.ErrFlagNotFound
	}
	fCopy := *f
	return &fCopy, nil
}

func (m *MemoryStore) UpsertFlag(_ context.Context, flag *domain.Flag) error {
	if flag.RolloutPercent < 0 || flag.RolloutPercent > 100 {
		return domain.ErrInvalidFlagRule
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	fCopy := *flag
	if fCopy.UpdatedAt.IsZero() {
		fCopy.UpdatedAt = time.Now().UTC()
	}
	m.flags[flag.Key] = &fCopy

	ev := ChangeEvent{Type: "flag", Key: flag.Key, Action: "upsert"}
	m.changes = append(m.changes, ev)
	m.notify(ev)

	return nil
}

func (m *MemoryStore) ListFlags(_ context.Context) ([]*domain.Flag, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*domain.Flag, 0, len(m.flags))
	for _, f := range m.flags {
		fCopy := *f
		result = append(result, &fCopy)
	}
	return result, nil
}

func (m *MemoryStore) GetConfig(_ context.Context, keys []string, scope string) ([]*domain.ConfigEntry, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if scope == "" {
		scope = "global"
	}

	var result []*domain.ConfigEntry
	if len(keys) == 0 {
		// Retornar todas las claves del scope
		prefix := scope + ":"
		for k, v := range m.configs {
			if strings.HasPrefix(k, prefix) {
				cCopy := *v
				result = append(result, &cCopy)
			}
		}
		return result, nil
	}

	for _, key := range keys {
		// Buscar primero en el scope solicitado (p. ej. tenant:123), si no está, fallback a global
		target := scope + ":" + key
		v, ok := m.configs[target]
		if !ok && scope != "global" {
			v, ok = m.configs["global:"+key]
		}
		if ok {
			cCopy := *v
			result = append(result, &cCopy)
		}
	}

	return result, nil
}

func (m *MemoryStore) SetConfig(_ context.Context, entry *domain.ConfigEntry) error {
	scope := entry.Scope
	if scope == "" {
		scope = "global"
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Validar contra esquema si existe
	if validator, ok := m.schemas[entry.Key]; ok {
		if err := validator.Validate(entry.Value); err != nil {
			return domain.ErrInvalidConfigValue
		}
	}

	eCopy := *entry
	eCopy.Scope = scope
	if eCopy.UpdatedAt.IsZero() {
		eCopy.UpdatedAt = time.Now().UTC()
	}

	m.configs[scope+":"+entry.Key] = &eCopy

	ev := ChangeEvent{Type: "config", Key: entry.Key, Action: "upsert"}
	m.changes = append(m.changes, ev)
	m.notify(ev)

	return nil
}

func (m *MemoryStore) SetMaintenance(_ context.Context, state *domain.MaintenanceState) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	sCopy := *state
	m.maintenance = &sCopy

	ev := ChangeEvent{Type: "maintenance", Key: state.Scope, Action: "upsert"}
	m.changes = append(m.changes, ev)
	m.notify(ev)

	return nil
}

func (m *MemoryStore) GetMaintenance(_ context.Context) (*domain.MaintenanceState, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sCopy := *m.maintenance
	return &sCopy, nil
}

func (m *MemoryStore) Subscribe(_ context.Context) (<-chan ChangeEvent, func()) {
	m.mu.Lock()
	defer m.mu.Unlock()

	ch := make(chan ChangeEvent, 100)
	m.subs[ch] = struct{}{}

	cancel := func() {
		m.mu.Lock()
		defer m.mu.Unlock()
		delete(m.subs, ch)
		close(ch)
	}

	return ch, cancel
}

func (m *MemoryStore) notify(ev ChangeEvent) {
	for ch := range m.subs {
		select {
		case ch <- ev:
		default:
			// No bloquear si el canal está lleno
		}
	}
}
