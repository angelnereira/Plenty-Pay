package service

import (
	"context"
	"errors"
	"time"

	"plentypay/identity/internal/auth"
	"plentypay/identity/internal/domain"
)

// PasswordResult es el resultado de las operaciones de contrasena.
type PasswordResult struct {
	Success      bool
	Reason       string
	ErrorMessage string
}

// ChangePassword cambia la contrasena del usuario (R14 exige step-up; R16 revoca
// las demas sesiones). keepSessionID vacio revoca todas.
func (s *IdentityService) ChangePassword(ctx context.Context, userID, currentPassword, newPassword, keepSessionID string) (*PasswordResult, error) {
	if err := domain.ValidatePassword(newPassword); err != nil {
		return &PasswordResult{Reason: "WEAK_PASSWORD", ErrorMessage: "la contrasena debe tener entre 12 y 128 caracteres"}, nil
	}
	// R14/R26: el token se consume antes de comparar la contraseña actual, para que esta ruta no
	// sirva para adivinarla sin confirmación fuerte.
	if err := s.requireContextStepUp(ctx, userID, domain.OpPasswordChange); err != nil {
		return nil, err
	}
	if s.passwords == nil {
		return &PasswordResult{ErrorMessage: "error interno"}, nil
	}
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return &PasswordResult{Reason: "NOT_FOUND", ErrorMessage: "usuario no encontrado"}, nil
	}
	// R: verificar la actual antes de cambiarla.
	if !auth.VerifyPassword(currentPassword, user.PasswordHash) {
		return &PasswordResult{Reason: "INVALID_CREDENTIALS", ErrorMessage: "contrasena actual incorrecta"}, nil
	}
	if auth.VerifyPassword(newPassword, user.PasswordHash) {
		return &PasswordResult{Reason: "SAME_PASSWORD", ErrorMessage: "la contrasena nueva debe ser distinta a la actual"}, nil
	}
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "password hashing failed", wrapErr(err, "hash password"))
		}
		return &PasswordResult{ErrorMessage: "error interno"}, nil
	}
	if err := s.passwords.ChangePassword(ctx, userID, hash, keepSessionID); err != nil {
		return nil, err
	}
	s.invalidateAliveCache()
	// ADR 0012: el evento de sesiones revocadas va al outbox con el efecto.
	if s.sessions != nil {
		_ = s.sessions.WriteOutboxEvent(ctx, "pp.identity.session.revoked.v1", userID, user.TenantID,
			sessionRevokedPayload(userID, nil, "PASSWORD_CHANGED"))
	}
	return &PasswordResult{Success: true}, nil
}

// RequestPasswordReset siempre responde igual (no revela si el correo existe,
// SPEC §4). Si existe, emite token y pide el correo por outbox.
func (s *IdentityService) RequestPasswordReset(ctx context.Context, email string) (*PasswordResult, error) {
	if s.passwords == nil {
		return &PasswordResult{Success: true}, nil
	}
	user, err := s.users.FindByEmail(ctx, domain.NormalizeEmail(email))
	if err != nil {
		// Correo inexistente: misma respuesta, ningun efecto observable.
		return &PasswordResult{Success: true}, nil
	}
	token, _, err := s.passwords.CreatePasswordReset(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	if s.sessions != nil {
		_ = s.sessions.WriteOutboxEvent(ctx, "pp.identity.notification.requested.v1", user.ID, "",
			notificationPayload(user.ID, "PASSWORD_RESET:"+token))
	}
	return &PasswordResult{Success: true}, nil
}

// ConfirmPasswordReset canjea el token y cambia la contrasena. R16: revoca
// TODAS las sesiones (no hay sesion actual que conservar).
func (s *IdentityService) ConfirmPasswordReset(ctx context.Context, token, newPassword string) (*PasswordResult, error) {
	if s.passwords == nil {
		return &PasswordResult{ErrorMessage: "error interno"}, nil
	}
	if err := domain.ValidatePassword(newPassword); err != nil {
		return &PasswordResult{Reason: "WEAK_PASSWORD", ErrorMessage: "la contrasena debe tener entre 12 y 128 caracteres"}, nil
	}
	userID, err := s.passwords.ConsumePasswordReset(ctx, token)
	if err != nil {
		if errors.Is(err, domain.ErrResetTokenExpired) {
			return &PasswordResult{Reason: "TOKEN_INVALID", ErrorMessage: "el enlace de recuperacion vencio"}, nil
		}
		if errors.Is(err, domain.ErrResetTokenUsed) {
			return &PasswordResult{Reason: "TOKEN_INVALID", ErrorMessage: "el enlace de recuperacion ya fue usado"}, nil
		}
		if errors.Is(err, domain.ErrResetTokenUnknown) {
			return &PasswordResult{Reason: "TOKEN_INVALID", ErrorMessage: "enlace de recuperacion invalido"}, nil
		}
		return nil, err
	}
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		if s.reporter != nil {
			s.reporter.Defect(ctx, "password hashing failed", wrapErr(err, "hash password"))
		}
		return &PasswordResult{ErrorMessage: "error interno"}, nil
	}
	if err := s.passwords.ChangePassword(ctx, userID, hash, ""); err != nil {
		return nil, err
	}
	s.invalidateAliveCache()
	if s.sessions != nil {
		_ = s.sessions.WriteOutboxEvent(ctx, "pp.identity.session.revoked.v1", userID, "",
			sessionRevokedPayload(userID, nil, "PASSWORD_CHANGED"))
	}
	if s.metrics != nil {
		s.metrics.Inc("pp_password_resets_total", "result", "success")
	}
	return &PasswordResult{Success: true}, nil
}

// PasswordChangedAt expone la marca para que el servidor invalide tokens viejos.
func (s *IdentityService) PasswordChangedAt(ctx context.Context, userID string) (*time.Time, error) {
	if s.passwords == nil {
		return nil, nil
	}
	return s.passwords.PasswordChangedAt(ctx, userID)
}

// invalidateAliveCache obliga a re-consultar el estado de las sesiones: tras un
// cambio de contrasena la cache no puede seguir diciendo "viva".
func (s *IdentityService) invalidateAliveCache() {
	s.revoked.invalidateAlive()
}
