package domain

// HalfUpDiv divide num/den redondeando la mitad hacia arriba (domain-model §4). Los montos fiscales
// nunca son negativos (las devoluciones son notas de crédito): un valor negativo o un divisor no
// positivo es una solicitud inválida.
func HalfUpDiv(num, den int64) (int64, error) {
	if num < 0 || den <= 0 {
		return 0, ErrInvalidRequest
	}
	return (num + den/2) / den, nil
}
