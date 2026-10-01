// Auditor en memoria para tests unitarios: registra eventos y permite
// aserciones sobre ellos.
package store

import (
	"context"
	"sync"
)

type AuditEntry struct {
	Event    string
	UserID   string
	TenantID string
	Detail   map[string]any
}

type MemoryAuditor struct {
	mu      sync.Mutex
	entries []AuditEntry
}

func NewMemoryAuditor() *MemoryAuditor { return &MemoryAuditor{} }

func (a *MemoryAuditor) Record(_ context.Context, event, userID, tenantID string, detail map[string]any) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.entries = append(a.entries, AuditEntry{Event: event, UserID: userID, TenantID: tenantID, Detail: detail})
}

func (a *MemoryAuditor) Entries() []AuditEntry {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := make([]AuditEntry, len(a.entries))
	copy(out, a.entries)
	return out
}
