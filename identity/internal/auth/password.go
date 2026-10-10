package auth

import "golang.org/x/crypto/bcrypt"

// Costo 12: más alto que el default de bcrypt (10) porque esto es el guardián de un sistema
// financiero — el costo extra de CPU en login es aceptable; abaratar el hash no lo es.
// (docs/standards/security-standards.md §2)
const bcryptCost = 12

func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyPassword compara en tiempo constante (bcrypt.CompareHashAndPassword).
func VerifyPassword(plain, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}
