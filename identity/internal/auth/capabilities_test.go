package auth_test

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"plentypay/identity/internal/auth"
)

// TestCapabilities_MatchesSecurityStandards verifica que la copia ejecutable en Go (PermissionCapabilityMap)
// coincide exactamente con la fuente de verdad en docs/standards/security-standards.md §3.1 (ADR 0010).
func TestCapabilities_MatchesSecurityStandards(t *testing.T) {
	content, err := os.ReadFile("../../../docs/standards/security-standards.md")
	if err != nil {
		t.Fatalf("leer security-standards.md: %v", err)
	}
	s := string(content)

	// Localizar sección 3.1
	idx := strings.Index(s, "### 3.1 Catálogo de permisos")
	if idx == -1 {
		t.Fatal("no se encontró sección 3.1 en security-standards.md")
	}
	sub := s[idx:]
	endIdx := strings.Index(sub, "### 3.2")
	if endIdx != -1 {
		sub = sub[:endIdx]
	}

	// Regex para filas: | modulo | `permiso` | `capacidad` |
	rowRe := regexp.MustCompile(`(?m)^\|\s*[^|]+\s*\|\s*` + "`" + `([^` + "`" + `]+)` + "`" + `\s*\|\s*` + "`" + `([^` + "`" + `]+)` + "`" + `\s*\|`)
	matches := rowRe.FindAllStringSubmatch(sub, -1)
	if len(matches) == 0 {
		t.Fatalf("no se encontraron filas de permisos en la tabla 3.1")
	}

	docMap := make(map[string]string, len(matches))
	for _, m := range matches {
		perm := m[1]
		cap := m[2]
		docMap[perm] = cap
	}

	codeMap := auth.PermissionCapabilityMap
	if len(docMap) != len(codeMap) {
		t.Errorf("número de permisos no coincide: documento=%d, código=%d", len(docMap), len(codeMap))
	}

	for perm, expectedCap := range docMap {
		actualCap, ok := codeMap[perm]
		if !ok {
			t.Errorf("permiso en documento pero faltante en código: %s", perm)
			continue
		}
		if actualCap != expectedCap {
			t.Errorf("capacidad para %s no coincide: doc=%s, código=%s", perm, expectedCap, actualCap)
		}
	}

	for perm := range codeMap {
		if _, ok := docMap[perm]; !ok {
			t.Errorf("permiso en código pero faltante en documento: %s", perm)
		}
		if !auth.IsKnownPermission(perm) {
			t.Errorf("permiso en PermissionCapabilityMap no está en AllPermissions: %s", perm)
		}
	}
}
