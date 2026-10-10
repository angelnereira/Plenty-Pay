# 🧪 Testing HKA con Postman

## Colección Completa para Testing de HKA Web Service

---

## 📥 **INSTALACIÓN:**

### **1. Importar Colección:**

1. Abrir Postman
2. Click en "Import"
3. Seleccionar `postman/HKA-Collection.postman_collection.json`
4. Click "Import"

### **2. Configurar Variables:**

En la colección, ir a "Variables" y configurar:

```
baseUrl:        https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc
tokenEmpresa:   <TU_TOKEN_EMPRESA>
tokenPassword:  <TU_TOKEN_PASSWORD>
```

---

## 📋 **REQUESTS DISPONIBLES:**

### **1. Consultar Folios Restantes** ✅

**Método:** `FoliosRestantes`  
**Descripción:** Consulta folios disponibles en la licencia

**Request:**
```xml
<tem:FoliosRestantes>
  <tem:tokenEmpresa>{{tokenEmpresa}}</tem:tokenEmpresa>
  <tem:tokenPassword>{{tokenPassword}}</tem:tokenPassword>
</tem:FoliosRestantes>
```

**Visualizer:**
- Tabla con información de licencia
- Folios totales, utilizados y disponibles
- Fecha de ciclo actual

**Tests Automáticos:**
- ✅ Status 200
- ✅ Código respuesta = 200

---

### **2. Consultar RUC DV** ✅

**Método:** `ConsultarRucDV`  
**Descripción:** Valida RUC y obtiene dígito verificador

**Request:**
```xml
<tem:ConsultarRucDV>
  <tem:consultarRucDVRequest>
    <ser:tokenEmpresa>{{tokenEmpresa}}</ser:tokenEmpresa>
    <ser:tokenPassword>{{tokenPassword}}</ser:tokenPassword>
    <ser:tipoRuc>2</ser:tipoRuc>
    <ser:ruc>155596713-2-2015</ser:ruc>
  </tem:consultarRucDVRequest>
</tem:ConsultarRucDV>
```

**Visualizer:**
- Información del contribuyente
- Dígito verificador
- Estado de afiliación FE

---

### **3. Estado Documento** ✅

**Método:** `EstadoDocumento`  
**Descripción:** Consulta el estado de una factura

**Request:**
```xml
<tem:EstadoDocumento>
  <tem:tokenEmpresa>{{tokenEmpresa}}</tem:tokenEmpresa>
  <tem:tokenPassword>{{tokenPassword}}</tem:tokenPassword>
  <tem:datosDocumento>
    <ser:codigoSucursalEmisor>0000</ser:codigoSucursalEmisor>
    <ser:numeroDocumentoFiscal>0000000001</ser:numeroDocumentoFiscal>
    <ser:puntoFacturacionFiscal>001</ser:puntoFacturacionFiscal>
    <ser:tipoDocumento>01</ser:tipoDocumento>
    <ser:tipoEmision>01</ser:tipoEmision>
  </tem:datosDocumento>
</tem:EstadoDocumento>
```

---

## 🎨 **VISUALIZERS INCLUIDOS:**

Cada request tiene un **visualizer HTML** que muestra la respuesta de forma amigable:

### **Folios Restantes:**
![Folios](https://via.placeholder.com/600x400/FF6C37/FFFFFF?text=Tabla+de+Folios)

- Tabla styled con toda la información
- Colores brand (naranja #FF6C37)
- Responsive

### **Consultar RUC:**
![RUC](https://via.placeholder.com/600x300/4CAF50/FFFFFF?text=Info+RUC)

- Info box con datos del contribuyente
- Verde para indicar validación exitosa

---

## 🔧 **AGREGAR MÁS MÉTODOS:**

### **Template Base:**

```javascript
// En tab "Tests" del request
var jsonData = xml2Json(responseBody);
var result = jsonData['s:Envelope']['s:Body'].<MetodoResponse>.<MetodoResult>;

var template = `
<style>
  /* Tu CSS aquí */
</style>
<div class="container">
  <h2>Tu Título</h2>
  <!-- Tu HTML aquí -->
</div>
`;

pm.visualizer.set(template, {
  campo1: result['a:campo1'] || 'N/A',
  // ...más campos
});
```

---

## 📝 **EJEMPLO: Agregar Método Enviar**

### **Request:**

```xml
<tem:Enviar>
  <tem:tokenEmpresa>{{tokenEmpresa}}</tem:tokenEmpresa>
  <tem:tokenPassword>{{tokenPassword}}</tem:tokenPassword>
  <tem:documento>
    <!-- DocumentoElectronico completo -->
  </tem:documento>
</tem:Enviar>
```

### **Post-Response Script:**

```javascript
var jsonData = xml2Json(responseBody);
var result = jsonData['s:Envelope']['s:Body'].EnviarResponse.EnviarResult;

var template = `
<style>
  .success { background: #4CAF50; color: white; padding: 20px; border-radius: 8px; }
  .cufe { font-family: monospace; background: #f5f5f5; padding: 10px; word-break: break-all; }
</style>
<div class="container">
  <div class="success">
    <h2>✅ Factura Enviada Exitosamente</h2>
  </div>
  <p><strong>CUFE:</strong></p>
  <div class="cufe">{{cufe}}</div>
  <p><strong>QR:</strong> <a href="{{qr}}" target="_blank">Ver QR</a></p>
  <p><strong>Protocolo:</strong> {{protocolo}}</p>
</div>
`;

pm.visualizer.set(template, {
  cufe: result['a:cufe'] || 'N/A',
  qr: result['a:qr'] || '#',
  protocolo: result['a:nroProtocoloAutorizacion'] || 'N/A'
});
```

---

## 🧪 **TESTS AUTOMÁTICOS:**

### **Agregar Tests a tus Requests:**

```javascript
// Status code
pm.test('Status code is 200', () => {
  pm.response.to.have.status(200);
});

// Respuesta exitosa
pm.test('Response is successful', () => {
  var jsonData = xml2Json(responseBody);
  var result = jsonData['s:Envelope']['s:Body'].<MetodoResponse>.<MetodoResult>;
  pm.expect(result['a:codigo']).to.eql('200');
});

// CUFE válido (para Enviar)
pm.test('CUFE has correct length', () => {
  pm.expect(result['a:cufe']).to.have.lengthOf(66);
});

// Set variables
pm.test('Save CUFE to variable', () => {
  pm.collectionVariables.set('lastCUFE', result['a:cufe']);
});
```

---

## 🌐 **AMBIENTES:**

### **Crear Environment:**

1. Crear "HKA Demo"
   ```json
   {
     "baseUrl": "https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc",
     "tokenEmpresa": "DEMO_TOKEN",
     "tokenPassword": "DEMO_PASS"
   }
   ```

2. Crear "HKA Producción"
   ```json
   {
     "baseUrl": "https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc",
     "tokenEmpresa": "PROD_TOKEN",
     "tokenPassword": "PROD_PASS"
   }
   ```

---

## 🎯 **COLECCIÓN COMPLETA (Todos los 9 Métodos):**

| # | Método | Status |
|---|--------|--------|
| 1 | FoliosRestantes | ✅ Incluido |
| 2 | ConsultarRucDV | ✅ Incluido |
| 3 | EstadoDocumento | ✅ Incluido |
| 4 | Enviar | 📝 Agregar |
| 5 | AnulacionDocumento | 📝 Agregar |
| 6 | DescargaXML | 📝 Agregar |
| 7 | DescargaPDF | 📝 Agregar |
| 8 | EnvioCorreo | 📝 Agregar |
| 9 | RastreoCorreo | 📝 Agregar |

---

## 📚 **RECURSOS:**

- **Documentación HKA:** `HKA_Documentacion_Completa.md`
- **XML Builder:** `lib/hka/xml-builder.ts` (ejemplos de XML)
- **Respuestas:** `lib/hka/xml-parser.ts` (estructura de respuestas)

---

## 🔗 **EXPORT/IMPORT:**

### **Exportar Colección:**
1. En Postman: `...` → Export
2. Guardar en `postman/`

### **Compartir con Equipo:**
1. Commit la colección a Git
2. Equipo hace `git pull`
3. Import en Postman

---

**Creado:** 2025-12-08  
**Última actualización:** 2025-12-08  
**Versión:** 1.0.0
