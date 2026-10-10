# 🧪 Scripts de Prueba HKA

Este directorio contiene scripts para probar y validar la integración con HKA (TheFactoryHKA - Facturación Electrónica Panamá).

---

## 📁 Archivos

| Script | Propósito | Requiere Credenciales |
|--------|-----------|----------------------|
| `test-xml-generation.ts` | Valida generación de XML SOAP | ❌ No |
| `e2e-test-hka.ts` | Test completo de integración | ✅ Sí |

---

## 🚀 Quick Start

### 1. Test de Generación XML (Sin credenciales)

```bash
# Ejecutar desde la raíz del proyecto
npx tsx lib/features/hka/scripts/test-xml-generation.ts
```

**Qué valida**:
- ✅ Namespace 'ser' correcto (`Services.ObjComprobante`)
- ✅ Estructura XML completa
- ✅ Sin tags vacíos
- ✅ Elementos obligatorios presentes

**Salida esperada**:
```
✅ XML VÁLIDO - Listo para enviar a HKA
✅ Namespace correcto
✅ Estructura completa
✅ Sin tags vacíos
```

---

### 2. Test E2E (Requiere credenciales HKA)

#### IMPORTANTE: Tokens en Base de Datos

⚠️ **Los tokens HKA NO van en `.env`**

- Cada cliente tiene sus propios tokens almacenados en la **base de datos**
- Los tokens se configuran desde la UI en la sección de Configuración
- Los tokens están **encriptados** en la BD por seguridad

#### Opción 1: Usar clientId (RECOMENDADO)

```bash
# Obtiene tokens de la base de datos del cliente
npx tsx lib/features/hka/scripts/e2e-test-hka.ts --client-id="uuid-del-cliente"
```

#### Opción 2: Variables de ambiente (solo para testing manual del desarrollador)

```bash
# Solo para pruebas manuales, NO agregar al repositorio
export HKA_TOKEN_EMPRESA="tu_token_empresa_demo"
export HKA_TOKEN_PASSWORD="tu_token_password_demo"
npx tsx lib/features/hka/scripts/e2e-test-hka.ts
```

⚠️ **Solicitar credenciales de prueba a**:
- Email: soporte_fel_pa@thefactoryhka.com
- Web: https://felwiki.thefactoryhka.com.pa/

**Qué hace**:
1. ✅ Test de conexión (FoliosRestantes)
2. ✅ Envío de factura de prueba
3. ✅ Consulta de estado
4. ⚠️ Descarga PDF (opcional)
5. ⚠️ Descarga XML (opcional)

**Salida esperada (éxito)**:
```
╔══════════════════════════════════════╗
║  🎉 TEST E2E COMPLETADO EXITOSAMENTE  ║
╚══════════════════════════════════════╝
```

---

## 📖 Documentación Completa

Para más detalles, consulte:
- [`docs/HKA_IMPLEMENTACION_Y_TESTING.md`](../../../../docs/HKA_IMPLEMENTACION_Y_TESTING.md) - Guía completa de uso
- [`docs/PLAN_MEJORAS_HKA_2026.md`](../../../../docs/PLAN_MEJORAS_HKA_2026.md) - Plan de mejoras
- [`MEJORAS_HKA_IMPLEMENTADAS.md`](../../../../MEJORAS_HKA_IMPLEMENTADAS.md) - Resumen ejecutivo

---

## 🔧 Troubleshooting

### Error: "Namespace 'ser' incorrecto"

**Solución**: Ya está corregido en `lib/features/hka/types/types.ts:551`. Si persiste, ejecute:
```bash
git pull origin main
npm run build
```

### Error: "401 No autorizado"

**Causas**:
- Credenciales incorrectas en `.env.hka`
- Usando tokens de DEMO en PROD o viceversa

**Solución**: Verificar credenciales con:
```bash
cat .env.hka
```

### Error: "Cannot find module 'dotenv'"

**Solución**:
```bash
npm install dotenv
```

---

## 📞 Soporte

- **Email HKA**: soporte_fel_pa@thefactoryhka.com
- **Wiki HKA**: https://felwiki.thefactoryhka.com.pa/
- **Documentación oficial**: `docs/hka documentacion oficial 2026.md`

---

**Última actualización**: 2025-12-08
