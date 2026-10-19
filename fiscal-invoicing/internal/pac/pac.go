package pac

import "context"

// PacClient es el adaptador al proveedor autorizado de certificación (DGI).
type PacClient interface {
	// Issue envía el XML firmado y devuelve el CUFE y la URL del documento.
	Issue(ctx context.Context, xml []byte) (cufe string, qrURL string, err error)
	// GetStatus consulta el estado de un documento en el PAC.
	GetStatus(ctx context.Context, cufe string) (status string, err error)
}

// Simulator es un PAC simulado para desarrollo y pruebas (sandbox).
type Simulator struct{}

func (Simulator) Issue(_ context.Context, xml []byte) (string, string, error) {
	// Genera un CUFE simulado (no real).
	return "SIMULATED-CUFE-" + string(xml[:min(8, len(xml))]), "https://simulated/qr", nil
}

func (Simulator) GetStatus(_ context.Context, cufe string) (string, error) {
	return "ACCEPTED", nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
