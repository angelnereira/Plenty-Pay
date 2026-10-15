package domain

import (
	"crypto/sha256"
	"fmt"
	"sort"
	"strings"
)

// CanonicalizeAuditEvent genera una representación canónica determinista del evento para hash (SPEC §5 R4).
func CanonicalizeAuditEvent(e *AuditEvent) []byte {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("id:%s|tenant:%s|user:%s|role:%s|svc:%s|act:%s|t_kind:%s|t_id:%s|outcome:%s|ip:%s|req:%s|ts:%s",
		e.EventID, e.TenantID, e.ActorUserID, e.ActorRole, e.ActorService, e.Action,
		e.TargetKind, e.TargetID, e.Outcome, e.IPAddress, e.RequestID,
		e.OccurredAt.UTC().Format("2006-01-02T15:04:05.000000000Z"),
	))

	if len(e.Details) > 0 {
		keys := make([]string, 0, len(e.Details))
		for k := range e.Details {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteString("|details:")
		for _, k := range keys {
			b.WriteString(fmt.Sprintf("%s=%s;", k, e.Details[k]))
		}
	}
	return []byte(b.String())
}

// ComputeAuditHash calcula sha256(prev_hash || canonical(event)).
func ComputeAuditHash(prevHash []byte, e *AuditEvent) []byte {
	h := sha256.New()
	if len(prevHash) > 0 {
		h.Write(prevHash)
	}
	h.Write([]byte("|"))
	h.Write(CanonicalizeAuditEvent(e))
	return h.Sum(nil)
}
