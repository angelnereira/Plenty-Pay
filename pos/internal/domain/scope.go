package domain

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

// ErrBranchOutOfScope: la sesión o la venta es de una sucursal fuera del alcance (R15).
var ErrBranchOutOfScope = errors.New("branch out of scope")

// ErrBranchRequired: una persona abre la caja sin indicar la sucursal (R15).
var ErrBranchRequired = errors.New("branch required")

// BranchScope es el alcance por sucursal de quien llama (ADR 0018, `x-pp-branch-scope`).
type BranchScope struct {
	All      bool
	Branches map[string]bool
}

// ParseBranchScope: `*` = todas; lista de UUID = esas; vacío o basura = ninguna (nunca todas).
func ParseBranchScope(raw string) BranchScope {
	raw = strings.TrimSpace(raw)
	if raw == "*" {
		return BranchScope{All: true}
	}
	sc := BranchScope{Branches: map[string]bool{}}
	for _, p := range strings.Split(raw, ",") {
		if p = strings.TrimSpace(p); p != "" {
			if _, err := uuid.Parse(p); err == nil {
				sc.Branches[p] = true
			}
		}
	}
	return sc
}

// Allows: la sucursal está en el alcance. Lo que no tiene sucursal (anterior a F17.12) solo lo
// alcanza quien tiene todas.
func (s BranchScope) Allows(branchID string) bool {
	if s.All {
		return true
	}
	return branchID != "" && s.Branches[branchID]
}

// List devuelve las sucursales del alcance (nil = todas).
func (s BranchScope) List() []string {
	if s.All {
		return nil
	}
	out := make([]string, 0, len(s.Branches))
	for b := range s.Branches {
		out = append(out, b)
	}
	return out
}

// Branch es lo que pos sabe de una sucursal de identity (R15).
type Branch struct {
	ID     string
	Code   string
	Active bool
}
