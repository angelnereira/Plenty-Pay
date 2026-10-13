# Runbook — Política y Procedimiento de Unseal de OpenBao (F05.1, R6)

Este documento describe la arquitectura, la política de custodia de claves y el procedimiento operativo para el sellado/des-sellado (*unseal*) de **OpenBao** en la plataforma PlentyPay, en cumplimiento de la regla **R6** de [`security/SPEC.md`](../../security/SPEC.md).

---

## 1. Política de Unseal por Entorno

| Entorno | Método de Unseal | Mecanismo | Recuperación ante reinicio |
|---|---|---|---|
| **Local / Dev (Compose)** | Dev mode | In-memory, token de arranque fijado por variable | Inmediato (modo dev inicia des-sellado) |
| **Staging / Prod (Cloud)** | **Auto-unseal** (KMS) | Google Cloud KMS (`gcpckms`) / AWS KMS | Automático al arrancar el contenedor |
| **Self-Hosted / Bare-Metal** | **Shamir Secret Sharing (3-de-5)** | 5 claves generadas en `bao operator init`, umbral = 3 | Manual por al menos 3 custodios |

---

## 2. Custodios de Claves Shamir (Producción Self-Hosted)

En entornos de alta seguridad donde no se disponga de KMS en la nube, la clave maestra se divide mediante el esquema de Shamir con un umbral de **3 de 5** partes. Ninguna persona posee acceso suficiente para des-sellar la bóveda por sí sola.

| Custodio | Rol Organizacional | Método de Custodia Recomendado |
|---|---|---|
| **Custodio 1** | Líder de Seguridad de la Información (CISO) | Llave de seguridad física FIDO2 / GPG en hardware token |
| **Custodio 2** | Ingeniero Principal de Confiabilidad (SRE Lead) | Gestor de contraseñas corporativo con MFA físico |
| **Custodio 3** | Oficial de Cumplimiento Normativo (Compliance) | Caja de seguridad física / Sobre lacrado notariado |
| **Custodio 4** | Ingeniero de Plataforma (Platform Eng) | Llave GPG personal con respaldo cifrado |
| **Custodio 5** | Dirección de Tecnología (CTO) | Caja de seguridad física / Llave de respaldo |

---

## 3. Procedimiento Operativo de Unseal Manual (3-de-5)

Cuando OpenBao se reinicia en modo sellado (*Sealed: true*):

### Paso 1: Verificar el estado
```bash
bao status
# Salida esperada:
# Key Type                shamir
# Sealed                  true
# Total Shares            5
# Threshold               3
# Unseal Progress         0/3
```

### Paso 2: Ejecutar el comando de unseal con 3 custodios distintos
Cada custodio introduce su fragmento de clave de manera aislada (sin compartirla por canales de texto ni logs):

```bash
# Custodio 1
bao operator unseal <fragmento-clave-1>

# Custodio 2
bao operator unseal <fragmento-clave-2>

# Custodio 3 (al alcanzar el umbral 3/3, Sealed pasa a false)
bao operator unseal <fragmento-clave-3>
```

### Paso 3: Confirmar des-sellado y salud
```bash
bao status
# Salida: Sealed: false
curl -s http://openbao:8200/v1/sys/health | jq .
# HTTP 200 OK
```

---

## 4. Política en Entorno Local (Docker Compose)

Para pruebas locales y CI, OpenBao corre en contenedor con `bao server -dev`:
- Raíz del secreto: `secret/` (motor KV v2).
- Token de administración fijado en `security/.env`: `OPENBAO_DEV_ROOT_TOKEN_ID`.
- Solo expuesto en la red interna `data` de Docker Compose (puerto `8200`), inaccesible fuera de los servicios autorizados.
- Transit engine habilitado para cifrado por propósito (`national_id`, `payout_destination`, `biometric_template`, `tax_id`, `pac_credentials`).
