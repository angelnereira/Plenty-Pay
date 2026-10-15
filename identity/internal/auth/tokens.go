package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Dos secretos DISTINTOS para access y refresh: si uno se compromete, se rota sin invalidar el otro.
// Objetivo (ADR 0011): migrar a EdDSA con llaves en `security` para que el gateway verifique localmente.
type TokenIssuer struct {
	accessSecret  []byte
	refreshSecret []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewTokenIssuer(accessSecret, refreshSecret string) (*TokenIssuer, error) {
	if len(accessSecret) < 32 || len(refreshSecret) < 32 {
		return nil, errors.New("los secretos de token deben tener al menos 32 caracteres")
	}
	if accessSecret == refreshSecret {
		return nil, errors.New("ACCESS_TOKEN_SECRET y REFRESH_TOKEN_SECRET no pueden ser el mismo valor")
	}
	return &TokenIssuer{
		accessSecret:  []byte(accessSecret),
		refreshSecret: []byte(refreshSecret),
		accessTTL:     15 * time.Minute, // corto a propósito — el refresh token es el que dura
		refreshTTL:    30 * 24 * time.Hour,
	}, nil
}

type Claims struct {
	UserID    string `json:"user_id"`
	TenantID  string `json:"tenant_id"`
	Role      string `json:"role"`
	SessionID string `json:"session_id"`
	// TokenID identifica la emision: dos tokens del mismo segundo serian
	// identicos byte a byte sin el (claims iguales + misma firma). Impide que
	// el refresh rotado parezca el anterior (R8).
	TokenID string `json:"token_id"`
	jwt.RegisteredClaims
}

// IssueAccessToken emite el access token de una sesion (R9: lleva session_id).
func (t *TokenIssuer) IssueAccessToken(sessionID, userID, tenantID, role string) (string, error) {
	return t.sign(sessionID, userID, tenantID, role, t.accessSecret, t.accessTTL)
}

// IssueRefreshToken emite el refresh token de una sesion.
func (t *TokenIssuer) IssueRefreshToken(sessionID, userID, tenantID, role string) (string, error) {
	return t.sign(sessionID, userID, tenantID, role, t.refreshSecret, t.refreshTTL)
}

func (t *TokenIssuer) sign(sessionID, userID, tenantID, role string, secret []byte, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		SessionID: sessionID,
		TokenID:   uuid.NewString(),
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        sessionID,
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func (t *TokenIssuer) VerifyAccessToken(tokenStr string) (*Claims, error) {
	return t.verify(tokenStr, t.accessSecret)
}

func (t *TokenIssuer) VerifyRefreshToken(tokenStr string) (*Claims, error) {
	return t.verify(tokenStr, t.refreshSecret)
}

func (t *TokenIssuer) verify(tokenStr string, secret []byte) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		// Fijar el algoritmo: rechaza "alg: none" y confusiones de algoritmo.
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de firma inesperado: %v", token.Header["alg"])
		}
		return secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !token.Valid {
		return nil, errors.New("token inválido o expirado")
	}
	return claims, nil
}
