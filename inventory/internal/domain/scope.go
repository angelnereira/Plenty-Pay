package domain

import (
	"errors"
	"strings"

	"github.com/google/uuid"
)

// ErrBranchOutOfScope: la bodega (o la sucursal pedida) está fuera del alcance del usuario (R11).
var ErrBranchOutOfScope = errors.New("branch out of scope")

// MainBranchCode es el código DGI de la Casa Matriz en identity.
const MainBranchCode = "0000"

// BranchScope es el alcance por sucursal de quien llama (ADR 0018, `x-pp-branch-scope`).
type BranchScope struct {
	All      bool
	Branches map[string]bool
}

// ParseBranchScope: `*` = todas; lista de UUID separados por coma = esas; vacío = ninguna (nunca
// todas: grpc-conventions.md). Los valores que no son UUID se ignoran.
func ParseBranchScope(raw string) BranchScope {
	raw = strings.TrimSpace(raw)
	if raw == "*" {
		return BranchScope{All: true}
	}
	sc := BranchScope{Branches: map[string]bool{}}
	for _, p := range strings.Split(raw, ",") {
		p = strings.TrimSpace(p)
		if _, err := uuid.Parse(p); err == nil {
			sc.Branches[p] = true
		}
	}
	return sc
}

// Allows: la sucursal está en el alcance. Una bodega sin sucursal (Casa Matriz sin asignar) solo
// la alcanza quien tiene todas.
func (s BranchScope) Allows(branchID string) bool {
	if s.All {
		return true
	}
	return branchID != "" && s.Branches[branchID]
}

// Branch es lo que inventory sabe de una sucursal de identity (R11).
type Branch struct {
	ID     string
	Code   string
	Active bool
}
