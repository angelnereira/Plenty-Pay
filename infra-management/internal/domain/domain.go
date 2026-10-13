package domain

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var (
	ErrFlagNotFound         = errors.New("flag not found")
	ErrInvalidFlagRule      = errors.New("invalid flag rule")
	ErrConfigNotFound       = errors.New("config not found")
	ErrInvalidConfigValue   = errors.New("invalid config value")
	ErrApprovalRequired     = errors.New("approval required")
	ErrIdempotencyKeyReused = errors.New("idempotency key reused")
)

type Flag struct {
	Key            string
	Description    string
	Enabled        bool
	RolloutPercent int32
	AllowTenants   []string
	AllowRoles     []string
	UpdatedAt      time.Time
	UpdatedBy      string
	SafeDefault    bool
}

type FlagContext struct {
	TenantID   string
	UserID     string
	Role       string
	AppVersion string
	Platform   string
}

// Evaluate aplica las reglas del feature flag determinísticamente (SPEC §5 R5).
func (f *Flag) Evaluate(ctx *FlagContext) bool {
	if !f.Enabled {
		return false
	}

	if ctx == nil {
		return f.RolloutPercent >= 100 || (len(f.AllowTenants) == 0 && len(f.AllowRoles) == 0)
	}

	// 1. Whitelist de tenants
	if len(f.AllowTenants) > 0 {
		matched := false
		for _, t := range f.AllowTenants {
			if t == ctx.TenantID && t != "" {
				matched = true
				break
			}
		}
		if matched {
			return true
		}
	}

	// 2. Whitelist de roles
	if len(f.AllowRoles) > 0 {
		matched := false
		for _, r := range f.AllowRoles {
			if r == ctx.Role && r != "" {
				matched = true
				break
			}
		}
		if matched {
			return true
		}
	}

	// Si hay listas de inclusión explícitas y ninguna coincidió, no aplica rollout general a menos que no haya restricciones
	if (len(f.AllowTenants) > 0 || len(f.AllowRoles) > 0) && f.RolloutPercent == 0 {
		return false
	}

	// 3. Rollout porcentual determinista: hash(key + user_id) mod 100 (SPEC §5 R5)
	if f.RolloutPercent > 0 && f.RolloutPercent < 100 {
		subject := ctx.UserID
		if subject == "" {
			subject = ctx.TenantID
		}
		if subject == "" {
			return f.SafeDefault
		}
		h := sha256.Sum256([]byte(f.Key + ":" + subject))
		val := binary.BigEndian.Uint32(h[:4]) % 100
		return int32(val) < f.RolloutPercent
	}

	if f.RolloutPercent == 0 && (len(f.AllowTenants) > 0 || len(f.AllowRoles) > 0) {
		return false
	}

	return true
}

type ConfigEntry struct {
	Key       string
	Value     string
	Scope     string // "global" | "tenant:<id>"
	UpdatedAt time.Time
}

type MaintenanceState struct {
	Enabled bool
	Scope   string
	Message string
	Until   time.Time
}

type ServiceInfo struct {
	Name      string
	Version   string
	GitSHA    string
	Status    string
	Replicas  int32
	StartedAt time.Time
}

type ClientConfig struct {
	MinimumAppVersion string
	UpdateRequired    bool
	BannerMessage     string
	Maintenance       MaintenanceState
	LatestAppVersion  string
	ApiBaseUrl        string
	RealtimeUrl       string
	Features          map[string]string
}

// ConfigValidator valida valores de configuración según su esquema.
type ConfigValidator interface {
	Validate(value string) error
}

type SimpleTypeValidator struct {
	ExpectedType string // "integer", "boolean", "string", "json_array"
	MinInt       *int64
	MaxInt       *int64
}

func (v *SimpleTypeValidator) Validate(value string) error {
	switch v.ExpectedType {
	case "integer":
		val, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if err != nil {
			return fmt.Errorf("valor no es un entero: %w", err)
		}
		if v.MinInt != nil && val < *v.MinInt {
			return fmt.Errorf("valor %d menor al mínimo %d", val, *v.MinInt)
		}
		if v.MaxInt != nil && val > *v.MaxInt {
			return fmt.Errorf("valor %d mayor al máximo %d", val, *v.MaxInt)
		}
		return nil
	case "boolean":
		val := strings.TrimSpace(strings.ToLower(value))
		if val != "true" && val != "false" {
			return errors.New("valor debe ser 'true' o 'false'")
		}
		return nil
	case "json_array":
		var arr []any
		if err := json.Unmarshal([]byte(value), &arr); err != nil {
			return fmt.Errorf("valor debe ser un arreglo JSON válido: %w", err)
		}
		return nil
	case "string":
		if strings.TrimSpace(value) == "" {
			return errors.New("valor de texto no puede estar vacío")
		}
		return nil
	default:
		return nil
	}
}

// CompareSemver compara dos versiones semánticas ("1.2.3" vs "1.2.4").
// Devuelve -1 si v1 < v2, 0 si v1 == v2, 1 si v1 > v2.
func CompareSemver(v1, v2 string) int {
	clean := func(s string) []int {
		parts := strings.Split(strings.TrimPrefix(strings.TrimSpace(s), "v"), ".")
		nums := make([]int, 0, len(parts))
		for _, p := range parts {
			n, _ := strconv.Atoi(p)
			nums = append(nums, n)
		}
		for len(nums) < 3 {
			nums = append(nums, 0)
		}
		return nums
	}

	p1 := clean(v1)
	p2 := clean(v2)
	for i := 0; i < 3; i++ {
		if p1[i] < p2[i] {
			return -1
		}
		if p1[i] > p2[i] {
			return 1
		}
	}
	return 0
}
