# 🔌 Integración HKA - Facturación Electrónica Panamá

## Descripción General

PlentyPay se integra con The Factory HKA para la certificación de facturas electrónicas ante la DGI de Panamá. El servicio utiliza protocolo SOAP con autenticación por tokens.

---

## Endpoints

| Ambiente | URL | Uso |
|----------|-----|-----|
| **Demo** | `https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc` | Pruebas (sin validez fiscal) |
| **Producción** | `https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc` | Facturas reales |

---

## Autenticación

Todos los métodos requieren:

| Parámetro | Descripción |
|-----------|-------------|
| `tokenEmpresa` | Identificador único de la empresa (proporcionado por HKA) |
| `tokenPassword` | Contraseña del token |

Las credenciales se capturan durante el **registro** (si se selecciona el módulo de Facturación Fiscal) y se pueden actualizar en `/dashboard/configuracion`. El ambiente siempre es PROD — ya no hay selección manual de demo/prod, el sistema lo determina automáticamente por las propias credenciales.

---

## Métodos Implementados (9/9)

| # | Método | Descripción | Estado |
|---|--------|-------------|--------|
| 1 | **Enviar** | Emisión de documentos fiscales | ✅ |
| 2 | **EstadoDocumento** | Consulta estado en DGI | ✅ |
| 3 | **AnulacionDocumento** | Anulación fiscal | ✅ |
| 4 | **DescargaXML** | Descarga XML firmado | ✅ |
| 5 | **FoliosRestantes** | Control de folios disponibles | ✅ |
| 6 | **EnvioCorreo** | Envío de factura por email | ✅ |
| 7 | **DescargaPDF** | Descarga CAFE en PDF | ✅ |
| 8 | **RastreoCorreo** | Tracking de emails | ✅ |
| 9 | **ConsultarRucDV** | Validación de RUC | ✅ |

---

## Tipos de Documento

| Código | Descripción |
|--------|-------------|
| 01 | Factura de operación interna |
| 02 | Factura de importación |
| 03 | Factura de exportación |
| 04 | Nota de Crédito (referencia FE) |
| 05 | Nota de Débito (referencia FE) |
| 06 | Nota de Crédito genérica |
| 07 | Nota de Débito genérica |

---

## Tipos de Cliente

| Código | Tipo | Campos Requeridos |
|--------|------|-------------------|
| 01 | Contribuyente | RUC, DV, razón social, dirección, ubicación |
| 02 | Consumidor Final | Ninguno obligatorio |
| 03 | Gobierno | RUC, DV, razón social, código CPBS |
| 04 | Extranjero | tipo/número identificación, país |

---

## Tasas de ITBMS

| Código | Porcentaje | Aplicación |
|--------|------------|------------|
| 00 | 0% | Exento |
| 01 | 7% | Tasa general |
| 02 | 10% | Bebidas alcohólicas, hospedaje |
| 03 | 15% | Tabaco |

---

## Códigos de Respuesta (Catálogo Oficial HKA)

### Método Enviar
| Código | Mensaje |
|--------|---------|
| 200 | El documento se envió correctamente |
| 101 | El Token del Emisor es Inválido |
| 102 | El documento está duplicado |
| 109 | El campo [campo] es inválido |
| 109 | La longitud del campo [campo] no cumple con el rango permitido |
| 109 | El campo [campo] debe ser numérico |
| 109 | El campo [campo] es requerido |
| 109 | En la ocurrencia [n] de [campo] - Error de validación |
| 109 | El campo [campo] no debe ser informado |
| 201 | Error al procesar solicitud |
| 300 | Reenviar documento |

### Otros Métodos
| Código | Significado | Acción |
|--------|-------------|--------|
| 200 | Éxito | Procesar respuesta |
| 100 | Sin datos / Token inválido (ConsultarRuc) | Verificar parámetros |
| 101 | Token inválido | Verificar credenciales HKA |
| 102 | Documento duplicado/no existe | Verificar número o CUFE |
| 109 | Error de validación | **Ver mensaje para campo específico** |
| 201 | Error de procesamiento | Reintentar |
| 202 | Error DGI | Reintentar más tarde |

---

## Estructura del Documento

```xml
<documento>
  <codigoSucursalEmisor>0000</codigoSucursalEmisor>
  <datosTransaccion>
    <tipoEmision>01</tipoEmision>
    <tipoDocumento>01</tipoDocumento>
    <numeroDocumentoFiscal>0000000001</numeroDocumentoFiscal>
    <puntoFacturacionFiscal>001</puntoFacturacionFiscal>
    <fechaEmision>2025-01-01T10:00:00-05:00</fechaEmision>
    <naturalezaOperacion>01</naturalezaOperacion>
    <tipoOperacion>1</tipoOperacion>
    <destinoOperacion>1</destinoOperacion>
    <cliente>...</cliente>
  </datosTransaccion>
  <listaItems>...</listaItems>
  <totalesSubTotales>...</totalesSubTotales>
</documento>
```

---

## Motor de Reconciliación DGI

La DGI rechaza documentos con errores de secuencia (códigos **2500-2507**) cuando el `numeroDocumentoFiscal` tiene huecos o está fuera de orden. El Motor de Reconciliación opera como una capa de pre-validación antes de cada emisión:

### Errores que previene

| Código DGI | Descripción |
|-----------|-------------|
| 2500 | Número de documento fuera de secuencia |
| 2501 | Hueco en la secuencia de documentos |
| 2502-2507 | Variantes de error de correlatividad |

### Cómo funciona

1. Antes de emitir, consulta el último `numeroDocumentoFiscal` registrado en la BD (`Client.lastInvoiceNumber`)
2. Verifica que el nuevo número sea exactamente `lastInvoiceNumber + 1`
3. Si detecta un hueco, intenta repararlo consultando el estado de documentos intermedios con `EstadoDocumento`
4. Solo emite si la secuencia es válida o fue reparada exitosamente
5. Actualiza `Client.lastInvoiceNumber` tras cada emisión exitosa

**Implementación:** `features/hka/model/services/hka-reconciliation.service.ts`

---

## Flujo de Emisión

```
1. Usuario crea factura en UI
2. Server Action valida datos
3. Mapper convierte a formato HKA
4. SOAP Client envía a HKA
5. HKA valida y envía a DGI
6. DGI retorna CUFE + QR
7. Se guarda en BD con estado EMITTED
8. Usuario recibe confirmación
```

---

## Configuración de Ambiente

El ambiente (Demo o Producción) se determina automáticamente a través de las credenciales (tokens) configuradas por cada cliente/usuario en la base de datos. 

Al guardar las credenciales, el sistema realiza una prueba de conexión (`FoliosRestantes`) contra los servidores de Demo y Producción para identificar el ambiente correcto sin necesidad de configuración manual.

---

## Troubleshooting

### Error 101: Token inválido
- Verificar credenciales en `/dashboard/configuracion`
- Confirmar que las credenciales corresponden al ambiente activo

### Error 109: Validación de campo
- Revisar formato de RUC (ej: `155596713-2-2015`)
- Verificar DV con método ConsultarRucDV
- Campos numéricos con formato correcto (ej: `0000000001`)

### Error 102: Documento duplicado
- El `numeroDocumentoFiscal` ya fue usado
- Usar el siguiente número secuencial

---

*Documentación basada en HKA Web Service v1.0 - Última actualización: Abril 2026*
