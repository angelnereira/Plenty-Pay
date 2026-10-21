# ADR 0020 — WebAuthn y PIN verificado en el servidor como únicas confirmaciones fuertes

- **Estado**: Aceptada
- **Fecha**: 2026-10-20
- **Decisores**: dueño del producto y dirección técnica de PlentyPay

## Contexto
`security-standards.md` §4 exige confirmación fuerte (step-up) para pagos sobre el umbral,
reembolsos, nómina, cambios de credenciales y de roles con dinero. El código no la cumplía: la app
comparaba un PIN en el teléfono (rechazaba solo `0000`) e identity emitía el token sin verificar
ninguna aserción, con retos y tokens en memoria y el usuario tomado del cuerpo de la petición
(hallazgos B1–B12 de [`docs/security/strong-authentication.md`](../security/strong-authentication.md)).
Además `ChangePassword` aceptaba cualquier token no vacío sin consumirlo.

## Decisión
1. **La confirmación fuerte solo la decide identity**, verificando una de dos pruebas:
   - una **aserción WebAuthn (passkey)** con verificación de usuario, contra la llave pública
     registrada, el reto de un solo uso, el origen, el `rpId` y el contador; con
     `github.com/go-webauthn/webauthn` fijada a una versión exacta (BSD-3, ADR 0001: Go, sin
     proveedores externos);
   - un **PIN de 6 dígitos guardado y verificado por identity** (mismo esquema que la contraseña),
     con bloqueo tras los intentos configurados.

   La biometría del dispositivo solo libera la llave de la passkey o desbloquea la app; su resultado
   nunca viaja ni se acepta como prueba.
2. **Cada operación declara su nivel y sus métodos** en un catálogo único
   (`security-standards.md` §4.1): nivel 2 acepta `PASSKEY` o `PIN`; nivel 3 acepta `PASSWORD`.
   Crear o cambiar el PIN es nivel 3: el PIN nunca se cambia con el propio PIN.
3. **Retos, tokens, passkeys y PIN viven en PostgreSQL** con RLS por usuario; del token solo se
   guarda su hash; `ConsumeStepUp` es un `UPDATE` atómico.
4. **El usuario sale siempre de los metadatos** (ADR 0011): el campo `user_id` del cuerpo de
   `StepUpRequest` y de `ChangePasswordRequest` queda obsoleto.
5. **Passkeys para iniciar sesión** (F28.2) sin depender de EdDSA/JWKS (F28.1), con el mismo error
   genérico que `Login`.
6. **Sin dominio estable no hay passkeys.** Mientras `WEBAUTHN_RP_ID` esté vacío (Q-39: producción
   usa un túnel con URL cambiante, ADR 0019), identity responde `PASSKEYS_UNAVAILABLE` y el PIN es
   el método de nivel 2 en todas las plataformas.
7. La app tiene un **registro único de capacidades del dispositivo** (`device.*`) que pide cada
   permiso al usarlo, con explicación previa, y lo muestra en una sola pantalla (S-GEN-23).

## Consecuencias
- F05.6 vuelve a 📝 hasta que pasen R25–R32 de identity; F28.2 se adelanta sin esperar a F28.1;
  F23.8 (registro de capacidades del dispositivo) es un paso nuevo.
- Mientras Q-38 y Q-42 no exijan passkey, una persona con el PIN puede confirmar: el riesgo se acepta
  y se compensa con avisos, topes y revocación (sección 10 del documento de diseño). Ningún paso con
  dinero real se habilita por esto antes de F30.3.
- Cada servicio que pide step-up usa los nombres de operación del catálogo; uno nuevo se agrega
  primero al catálogo y al glosario.
