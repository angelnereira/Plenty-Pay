# HKA SOAP Services - Migración a Cliente SOAP Real

**Fecha de migración**: 2025-12-08
**Estado**: ✅ COMPLETADO

---

## 🎯 Cambio Principal

**MIGRADO de fetch manual a cliente SOAP profesional (package `soap`)**

### Antes (fetch manual)
```typescript
// Construcción manual de XML
const xmlBody = buildSoapXml(/* ... */);
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/xml' },
  body: xmlBody
});
```

### Después (cliente SOAP)
```typescript
// Cliente SOAP automático desde WSDL
const client = await getHKASoapClient(config);
const result = await callSoapMethod(client, 'Enviar', args);
```

---

## ✅ Ventajas del Cliente SOAP

1. **Lee WSDL automáticamente** del endpoint
2. **Maneja namespaces automáticamente** del WSDL
3. **Compatible con forma oficial de HKA** (similar a PHP SoapClient, C# ServiceClient)
4. **Menos propenso a errores** de formato XML
5. **Retry logic integrado** con exponential backoff
6. **Caching de clientes** por ambiente (demo/prod)
7. **Logging completo** de todas las operaciones

---

## 📁 Archivos Modificados

### Nuevo: `hka-soap-client.service.ts`
**Propósito**: Gestión del cliente SOAP con el package `soap`

**Funciones principales**:
- `getHKASoapClient(config)` - Obtiene/crea cliente SOAP (con cache)
- `callSoapMethod(client, methodName, args)` - Llamada genérica con retry
- `clearSoapClientCache(environment?)` - Limpia cache
- `describeHKAServices(config)` - Debugging del WSDL

**Características**:
```typescript
// URLs oficiales HKA
const WSDL_URLS = {
  demo: 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc',
  prod: 'https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc',
};

// Cache por ambiente
const clientCache = new Map<string, Client>();

// Retry con exponential backoff: 1s → 2s → 4s
for (let attempt = 1; attempt <= retries + 1; attempt++) {
  // ...
  if (attempt <= retries) {
    await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
  }
}
```

### Reescrito: `hka-soap.service.ts`
**Cambio**: Migrado de fetch a cliente SOAP

**Métodos migrados** (9 en total):
1. `enviarFactura()` - Enviar/Crear factura
2. `consultarEstadoDocumento()` - Estado de documento
3. `consultarFoliosRestantes()` - Folios disponibles
4. `consultarRucDV()` - Validar RUC
5. `descargarPDF()` - Descargar PDF
6. `descargarXML()` - Descargar XML firmado
7. `anularDocumento()` - Anular factura
8. `enviarCorreo()` - Enviar por email
9. `rastrearCorreo()` - Rastrear emails

**Patrón de migración**:
```typescript
// ANTES (fetch manual)
export async function consultarFoliosRestantes(config: HKAConfig) {
  const xmlBody = buildSoapXml(/* ... */);
  const response = await fetch(url, { /* ... */ });
  const result = await parseXmlResponse(response);
  return processResponse(result);
}

// DESPUÉS (cliente SOAP)
export async function consultarFoliosRestantes(config: HKAConfig) {
  const client = await getHKASoapClient(config);
  const args = {
    tokenEmpresa: config.tokenEmpresa,
    tokenPassword: config.tokenPassword,
  };
  const rawResponse = await callSoapMethod(client, 'FoliosRestantes', args);
  const response = processHKAResponse(rawResponse, 'FoliosRestantesResult');

  // Mapeo case-insensitive de campos
  if (response.success && response.data) {
    response.data = {
      licencia: response.data.licencia || response.data.Licencia || '',
      foliosDisponiblesCiclo: response.data.foliosDisponiblesCiclo ||
                               response.data.FoliosDisponiblesCiclo || 0,
      // ...
    };
  }
  return response;
}
```

---

## 🔧 Cambios Técnicos Clave

### 1. Cliente SOAP Automático
```typescript
// El cliente SOAP obtiene el WSDL automáticamente del endpoint
const client = await soap.createClientAsync(wsdlUrl);
```

### 2. Mapeo Case-Insensitive
HKA puede retornar campos con PascalCase o camelCase:
```typescript
// Maneja ambos casos
licencia: response.data.licencia || response.data.Licencia || ''
```

### 3. Método Async Pattern
```typescript
// El package 'soap' genera métodos con sufijo Async
const methodAsync = `${methodName}Async`; // ej: "EnviarAsync"
const [result] = await (client as any)[methodAsync](args);
```

### 4. Procesamiento de Respuesta Unificado
```typescript
function processHKAResponse<T>(rawResponse: any, resultKey: string): HKAResponse<T> {
  // Extrae {MethodNameResponse: {MethodNameResult: {...}}}
  const resultData = rawResponse[resultKey];

  // Normaliza códigos de éxito
  const success = codigo === '200' || codigo === '102' || resultado === 'procesado';

  return { success, code, message, data };
}
```

---

## 📦 Dependencias Agregadas

```json
{
  "dependencies": {
    "soap": "^1.5.0"
  },
  "devDependencies": {
    "@types/soap": "^0.21.0"
  }
}
```

**Instalación**:
```bash
npm install soap
npm install --save-dev @types/soap
```

---

## 🧪 Testing

### Script de Validación XML (Sin credenciales)
```bash
npx tsx lib/features/hka/scripts/test-xml-generation.ts
```

### Script E2E (Requiere credenciales HKA)
```bash
# Configurar credenciales
echo "HKA_TOKEN_EMPRESA=tu_token" > .env.hka
echo "HKA_TOKEN_PASSWORD=tu_password" >> .env.hka

# Ejecutar test
npx tsx lib/features/hka/scripts/e2e-test-hka.ts
```

---

## 🎯 Resultado Esperado

Con esta migración, el sistema **DEBERÍA**:

✅ Comunicarse correctamente con HKA (DEMO/PROD)
✅ Leer WSDL automáticamente sin errores de namespace
✅ Enviar facturas y recibir CUFE exitosamente
✅ Manejar timeouts y reintentos automáticamente
✅ Loggear todas las operaciones para debugging

---

## 🔍 Debugging

### Ver servicios disponibles en WSDL
```typescript
import { describeHKAServices } from './hka-soap-client.service';

const config = { environment: 'demo', /* ... */ };
const services = await describeHKAServices(config);
console.log(JSON.stringify(services, null, 2));
```

### Limpiar cache de cliente
```typescript
import { clearSoapClientCache } from './hka-soap-client.service';

// Limpiar solo DEMO
clearSoapClientCache('demo');

// Limpiar todo
clearSoapClientCache();
```

---

## 📞 Soporte

**Si la comunicación sigue fallando**:

1. Verificar que las URLs de endpoint estén correctas
2. Revisar logs de HKALogger para detalles de error
3. Verificar que namespace XML sea correcto (ver `types.ts:551`)
4. Contactar soporte HKA: soporte_fel_pa@thefactoryhka.com

---

## 📚 Referencias

- Documentación oficial HKA 2026: `docs/hka documentacion oficial 2026.md`
- Plan de mejoras: `docs/PLAN_MEJORAS_HKA_2026.md`
- Guía de testing: `docs/HKA_IMPLEMENTACION_Y_TESTING.md`
- Package soap: https://www.npmjs.com/package/soap

---

**Última actualización**: 2025-12-08
**Versión**: 2.0.0 (Migración SOAP)
**Estado**: ✅ IMPLEMENTADO
