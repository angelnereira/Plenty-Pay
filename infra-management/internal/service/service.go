package service

import (
	"context"
	"sync"

	"plentypay/infra-management/internal/domain"
	"plentypay/infra-management/internal/store"
)

type InfraService struct {
	store      store.Store
	mu         sync.RWMutex
	flagCache  map[string]*domain.Flag
	stopCache  func()
	apiBaseURL string
	wsURL      string
}

func NewInfraService(s store.Store, apiBaseURL, wsURL string) *InfraService {
	if apiBaseURL == "" {
		apiBaseURL = "http://localhost:8080"
	}
	if wsURL == "" {
		wsURL = "ws://localhost:8080/v1/realtime"
	}

	svc := &InfraService{
		store:      s,
		flagCache:  make(map[string]*domain.Flag),
		apiBaseURL: apiBaseURL,
		wsURL:      wsURL,
	}

	svc.refreshCache(context.Background())
	svc.startCacheListener()

	return svc
}

func (s *InfraService) refreshCache(ctx context.Context) {
	flags, err := s.store.ListFlags(ctx)
	if err != nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, f := range flags {
		s.flagCache[f.Key] = f
	}
}

func (s *InfraService) startCacheListener() {
	ch, cancel := s.store.Subscribe(context.Background())
	s.stopCache = cancel

	go func() {
		for ev := range ch {
			if ev.Type == "flag" {
				if f, err := s.store.GetFlag(context.Background(), ev.Key); err == nil {
					s.mu.Lock()
					s.flagCache[f.Key] = f
					s.mu.Unlock()
				}
			}
		}
	}()
}

func (s *InfraService) Close() {
	if s.stopCache != nil {
		s.stopCache()
	}
}

// EvaluateFlags evalúa feature flags con caché local (SPEC §5 R1 y R5).
func (s *InfraService) EvaluateFlags(ctx context.Context, keys []string, fCtx *domain.FlagContext) (map[string]bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]bool, len(keys))
	for _, key := range keys {
		f, ok := s.flagCache[key]
		if !ok {
			// Intentar leer de store
			var err error
			f, err = s.store.GetFlag(ctx, key)
			if err != nil {
				// R1: si no existe en store, omitir o usar false
				continue
			}
		}
		result[key] = f.Evaluate(fCtx)
	}

	return result, nil
}

func (s *InfraService) UpsertFlag(ctx context.Context, flag *domain.Flag) (*domain.Flag, error) {
	if err := s.store.UpsertFlag(ctx, flag); err != nil {
		return nil, err
	}
	return s.store.GetFlag(ctx, flag.Key)
}

func (s *InfraService) ListFlags(ctx context.Context) ([]*domain.Flag, error) {
	return s.store.ListFlags(ctx)
}

func (s *InfraService) GetConfig(ctx context.Context, keys []string, scope string) ([]*domain.ConfigEntry, error) {
	return s.store.GetConfig(ctx, keys, scope)
}

func (s *InfraService) SetConfig(ctx context.Context, entry *domain.ConfigEntry) (*domain.ConfigEntry, error) {
	if err := s.store.SetConfig(ctx, entry); err != nil {
		return nil, err
	}
	entries, err := s.store.GetConfig(ctx, []string{entry.Key}, entry.Scope)
	if err != nil || len(entries) == 0 {
		return entry, nil
	}
	return entries[0], nil
}

func (s *InfraService) SetMaintenanceMode(ctx context.Context, state *domain.MaintenanceState) (*domain.MaintenanceState, error) {
	if err := s.store.SetMaintenance(ctx, state); err != nil {
		return nil, err
	}
	return s.store.GetMaintenance(ctx)
}

func (s *InfraService) GetMaintenanceState(ctx context.Context) (*domain.MaintenanceState, error) {
	return s.store.GetMaintenance(ctx)
}

// GetClientConfig evalúa y devuelve la configuración requerida por el cliente Flutter (F05.9).
func (s *InfraService) GetClientConfig(ctx context.Context, platform, appVersion string) (*domain.ClientConfig, error) {
	// 1. Obtener versiones mínimas
	configs, _ := s.store.GetConfig(ctx, []string{"client.min_app_version", "client.latest_app_version", "client.banner_message"}, "global")
	minVersion := "1.0.0"
	latestVersion := "1.0.0"
	bannerMessage := ""

	for _, c := range configs {
		switch c.Key {
		case "client.min_app_version":
			minVersion = c.Value
		case "client.latest_app_version":
			latestVersion = c.Value
		case "client.banner_message":
			bannerMessage = c.Value
		}
	}

	// 2. Comprobar si se exige actualización
	updateRequired := false
	if appVersion != "" {
		if domain.CompareSemver(appVersion, minVersion) < 0 {
			updateRequired = true
		}
	}

	// 3. Estado de mantenimiento
	mState, _ := s.store.GetMaintenance(ctx)
	if mState == nil {
		mState = &domain.MaintenanceState{Enabled: false, Scope: "global"}
	}

	// 4. Feature flags visibles para la app
	flags, _ := s.store.ListFlags(ctx)
	features := make(map[string]string)
	for _, f := range flags {
		val := "false"
		if f.Evaluate(&domain.FlagContext{Platform: platform, AppVersion: appVersion}) {
			val = "true"
		}
		features[f.Key] = val
	}

	return &domain.ClientConfig{
		MinimumAppVersion: minVersion,
		UpdateRequired:    updateRequired,
		BannerMessage:     bannerMessage,
		Maintenance:       *mState,
		LatestAppVersion:  latestVersion,
		ApiBaseUrl:        s.apiBaseURL,
		RealtimeUrl:       s.wsURL,
		Features:          features,
	}, nil
}

// ListServices lista los servicios del inventario oficial (service-dependencies.md §1).
func (s *InfraService) ListServices(_ context.Context) ([]*domain.ServiceInfo, error) {
	knownServices := []string{
		"api-gateway", "web", "identity", "ledger", "payments-core",
		"settlement", "fiscal-invoicing", "catalog", "inventory", "pos",
		"logistics", "geolocation", "payroll", "notifications", "analytics-bi",
		"security", "infra-management", "orders",
	}

	result := make([]*domain.ServiceInfo, 0, len(knownServices))
	for _, name := range knownServices {
		result = append(result, &domain.ServiceInfo{
			Name:     name,
			Version:  "dev",
			GitSHA:   "none",
			Status:   "SERVING",
			Replicas: 1,
		})
	}

	return result, nil
}
