# 🔒 Seguridad

## Resumen

PlentyPay implementa múltiples capas de seguridad para proteger datos sensibles y cumplir con regulaciones fiscales.

---

## Autenticación

### NextAuth v5

- **Estrategia**: JWT
- **Duración**: 30 días
- **Provider**: Credentials (email/password)
- **Hash**: bcryptjs (10 rounds)

### Roles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `SUPER_ADMIN` | Equipo PlentyPay | Acceso total, gestión de clientes |
| `CLIENT` | Usuario normal | Solo su organización |

---

## 🔐 Encriptación AES-256 - Nivel Militar

### ¿Por qué AES-256 en 2025?

**AES-256** (Advanced Encryption Standard con clave de 256 bits) representa el **estándar de oro** en criptografía moderna:

| Característica | Descripción |
|----------------|-------------|
| **Seguridad Militar** | Algoritmo aprobado por el gobierno de EE.UU. y la NSA para proteger información clasificada como "Top Secret" |
| **Inmune a Fuerza Bruta** | No existe ningún ataque práctico conocido que haya logrado romper una clave AES-256 |
| **Eficiencia** | Extremadamente rápido y requiere pocos recursos computacionales, funcionando desde superordenadores hasta teléfonos móviles |

### Usos Comunes de AES-256

| Industria | Aplicación |
|-----------|------------|
| **Comunicaciones** | WhatsApp, conexiones Wi-Fi (WPA2/WPA3) |
| **Almacenamiento** | Google Drive, OneDrive, cifrado de discos |
| **Finanzas** | Transacciones bancarias, tarjetas de crédito, SSL/TLS |

### Implementación en PlentyPay

#### Credenciales HKA
- **Algoritmo**: AES-256-CBC
- **Key**: `ENCRYPTION_KEY` (32 bytes hex = 256 bits)
- **Almacenamiento**: Credenciales encriptadas en base de datos
- **Descifrado**: Solo en backend, nunca expuesto a cliente

#### Certificados Digitales
- **Keys separadas**: `CERTIFICATE_ENCRYPTION_KEY`, `CERTIFICATE_MASTER_KEY`
- **Rotación**: Manual (cambiar key = re-encriptar)

---

## Generación de Keys

```bash
# NEXTAUTH_SECRET (base64)
openssl rand -base64 32

# ENCRYPTION_KEY (hex)
openssl rand -hex 32

# CERTIFICATE_ENCRYPTION_KEY (hex)
openssl rand -hex 32
```

---

## Protección de Datos

### Multi-Tenancy

- Todas las queries filtran por `clientId`
- Aislamiento completo entre organizaciones
- Middleware valida pertenencia

### Validación

- **Input**: Zod schemas en APIs y Server Actions
- **SQL Injection**: Prisma ORM (queries parametrizadas)
- **XSS**: React escapa automáticamente

---

## Headers de Seguridad

Configurados en `next.config.js`:

```javascript
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
]
```

---

## Variables Sensibles

### Nunca en Git

El `.gitignore` excluye:
- `.env*`
- `*credentials*`
- `*.secret`

### Solo en Vercel

Configurar en **Settings → Environment Variables**:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`
- Credenciales HKA

---

## Buenas Prácticas

1. **Keys diferentes** entre desarrollo y producción
2. **Rotación periódica** de secrets
3. **Logs sin credenciales** (sanitizar antes de loguear)
4. **HTTPS forzado** en producción
5. **Backup de keys** en gestor de contraseñas

---

## Auditoría

### AuditLog

Todas las acciones críticas se registran:

```typescript
await prisma.auditLog.create({
  data: {
    userId: session.user.id,
    action: 'INVOICE_CREATED',
    entity: 'Invoice',
    entityId: invoice.id,
    ip: request.ip
  }
});
```

---

## Rate Limiting

- API Keys con límite por minuto
- Configuración: `rateLimit` y `rateLimitWindow` por ApiKey

---

*Última actualización: Marzo 2026*
