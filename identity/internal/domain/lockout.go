package domain

import (
	"errors"
	"time"
)

// LockoutStep es un escalon del bloqueo progresivo (SPEC R5): al alcanzar
// `Failures` fallos consecutivos, la cuenta queda bloqueada `Block`.
type LockoutStep struct {
	Failures int
	Block    time.Duration
}

// LockoutPolicy es la escalera de bloqueos. Los valores son politica propia de
// PlentyPay, no constantes legales: N-STD-37 (NIST SP 800-63B) fija como maximo
// 100 intentos fallidos antes de deshabilitar un autenticador, y estos umbrales
// son mas estrictos.
type LockoutPolicy struct {
	Steps []LockoutStep
}

// DefaultLockoutPolicy es la politica del SPEC §5 R5: 5 fallos -> 1 min,
// 10 -> 15 min, 20 -> 24 h (+ notificacion, que emite el servicio).
var DefaultLockoutPolicy = LockoutPolicy{Steps: []LockoutStep{
	{Failures: 5, Block: 1 * time.Minute},
	{Failures: 10, Block: 15 * time.Minute},
	{Failures: 20, Block: 24 * time.Hour},
}}

// BlockFor devuelve el bloqueo que corresponde a `failures` fallos consecutivos
// (el escalon mas alto alcanzado) y si aplica alguno.
func (p LockoutPolicy) BlockFor(failures int) (time.Duration, bool) {
	var (
		block  time.Duration
		locked bool
	)
	for _, s := range p.Steps {
		if failures >= s.Failures {
			block, locked = s.Block, true
		}
	}
	return block, locked
}

// NotifiesAt indica si ese numero de fallos dispara la notificacion a la persona
// (R5: "+ notificacion" en el ultimo escalon).
func (p LockoutPolicy) NotifiesAt(failures int) bool {
	return failures >= 20 && len(p.Steps) > 0
}

// ErrAccountLocked se devuelve cuando la cuenta tiene un bloqueo vigente.
var ErrAccountLocked = errors.New("cuenta bloqueada por intentos fallidos")
