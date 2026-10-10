# 🧪 Colección Postman HKA - PlentyPay

## Estado: ✅ FUNCIONANDO EN PRODUCCIÓN

---

## 📋 **TU COLECCIÓN ACTUAL:**

### **Métodos Configurados:**
- ✅ POST Enviar
- ✅ POST EstadoDocumento
- ✅ POST Anulacion
- ✅ POST DescargaXML
- ✅ POST FoliosRestantes ⭐ (Verificado funcionando)
- ✅ POST EnvioCorreo
- ✅ POST DescargaPDF
- ✅ POST RastreoCorreo
- ✅ POST ConsultarRucDV

---

## 🌐 **CONFIGURACIÓN ACTUAL:**

### **Endpoint Producción:**
```
https://emision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc
```

### **Tokens Configurados:**
```
tokenEmpresa:  izmmise5gwyer_tlnka
tokenPassword: cZcb65CH5jb
```

---

## ✅ **VERIFICADO FUNCIONANDO:**

### **FoliosRestantes:**
```
Status: 200 OK
Response Time: 277 ms
Size: 778 B

Response:
- a:codigo: 200
- a:mensaje: "Se retorna Licencia y Disponibilidad"
```

---

## 🎨 **MEJORAS PARA TU COLECCIÓN:**

### **1. Scripts Post-Response para Visualizers**

#### **FoliosRestantes (Mejorado):**

En el tab "Scripts" → "Post-response":

```javascript
// Parse XML response
var jsonData = xml2Json(responseBody);
var result = jsonData['s:Envelope']['s:Body'].FoliosRestantesResponse.FoliosRestantesResult;

// Enhanced HTML Template
var template = `
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 30px;
        min-height: 100vh;
    }
    .container {
        max-width: 900px;
        margin: 0 auto;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden;
    }
    .header {
        background: linear-gradient(135deg, #FF6C37 0%, #FF8F6B 100%);
        color: white;
        padding: 30px;
        text-align: center;
    }
    .header h1 {
        font-size: 28px;
        font-weight: 600;
        margin-bottom: 8px;
    }
    .header p {
        opacity: 0.9;
        font-size: 14px;
    }
    .content {
        padding: 30px;
    }
    .status-badge {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 20px;
    }
    .status-success {
        background: #10b981;
        color: white;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    .card {
        background: #f8fafc;
        border-radius: 12px;
        padding: 20px;
        border: 2px solid #e2e8f0;
    }
    .card-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 8px;
    }
    .card-value {
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
    }
    .progress-bar {
        background: #e2e8f0;
        border-radius: 8px;
        height: 24px;
        overflow: hidden;
        margin-top: 8px;
    }
    .progress-fill {
        background: linear-gradient(90deg, #FF6C37, #FF8F6B);
        height: 100%;
        transition: width 1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
    }
    th {
        background: #f1f5f9;
        color: #334155;
        padding: 12px;
        text-align: left;
        font-weight: 600;
        font-size: 14px;
    }
    td {
        padding: 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 14px;
    }
    .mono { font-family: 'Courier New', monospace; }
</style>

<div class="container">
    <div class="header">
        <h1>📊 Folios Restantes - HKA</h1>
        <p>The Factory HKA - Sistema de Facturación Electrónica</p>
    </div>
    <div class="content">
        <span class="status-badge status-success">✓ Respuesta Exitosa ({{codigo}})</span>
        
        <div class="grid">
            <div class="card">
                <div class="card-label">Folios Disponibles</div>
                <div class="card-value">{{foliosDisponibleCiclo}}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {{porcentajeDisponible}}%">
                        {{porcentajeDisponible}}% disponible
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-label">Folios Utilizados</div>
                <div class="card-value" style="color: #f59e0b;">{{foliosUtilizadosCiclo}}</div>
            </div>
            
            <div class="card">
                <div class="card-label">Total del Ciclo</div>
                <div class="card-value" style="color: #8b5cf6;">{{foliosTotalesCiclo}}</div>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Campo</th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Licencia</strong></td>
                    <td class="mono">{{licencia}}</td>
                </tr>
                <tr>
                    <td><strong>Fecha de Licencia</strong></td>
                    <td>{{fechaLicencia}}</td>
                </tr>
                <tr>
                    <td><strong>Ciclo Actual</strong></td>
                    <td>{{ciclo}}</td>
                </tr>
                <tr>
                    <td><strong>Fecha del Ciclo</strong></td>
                    <td>{{fechaCiclo}}</td>
                </tr>
                <tr>
                    <td><strong>Folios Totales de Licencia</strong></td>
                    <td>{{foliosTotales}}</td>
                </tr>
                <tr>
                    <td><strong>Mensaje</strong></td>
                    <td>{{mensaje}}</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
`;

// Calculate percentage
var disponibles = parseInt(result['a:foliosDisponibleCiclo'] || 0);
var totales = parseInt(result['a:foliosTotalesCiclo'] || 1);
var porcentaje = Math.round((disponibles / totales) * 100);

// Set visualizer
pm.visualizer.set(template, {
    codigo: result['a:codigo'] || 'N/A',
    mensaje: result['a:mensaje'] || 'N/A',
    licencia: result['a:licencia'] || 'N/A',
    fechaLicencia: result['a:fechaLicencia'] || 'N/A',
    ciclo: result['a:ciclo'] || 'N/A',
    fechaCiclo: result['a:fechaCiclo'] || 'N/A',
    foliosTotalesCiclo: result['a:foliosTotalesCiclo'] || 'N/A',
    foliosUtilizadosCiclo: result['a:foliosUtilizadosCiclo'] || 'N/A',
    foliosDisponibleCiclo: result['a:foliosDisponibleCiclo'] || 'N/A',
    foliosTotales: result['a:foliosTotales'] || 'N/A',
    porcentajeDisponible: porcentaje
});

// Automated tests
pm.test('Status code is 200', function() {
    pm.response.to.have.status(200);
});

pm.test('Response is successful (code 200)', function() {
    pm.expect(result['a:codigo']).to.eql('200');
});

pm.test('Has available folios', function() {
    pm.expect(parseInt(result['a:foliosDisponibleCiclo'])).to.be.above(0);
});

// Console log for debugging
console.log('✅ Folios disponibles:', result['a:foliosDisponibleCiclo']);
console.log('📊 Folios utilizados:', result['a:foliosUtilizadosCiclo']);
console.log('📈 Porcentaje disponible:', porcentaje + '%');
```

---

## 🔧 **AGREGAR A TUS OTROS MÉTODOS:**

### **ConsultarRucDV:**

```javascript
var jsonData = xml2Json(responseBody);
var result = jsonData['s:Envelope']['s:Body'].ConsultarRucDVResponse.ConsultarRucDVResult;
var infoRuc = result['a:infoRuc'];

var template = `
<style>
    body { font-family: Arial; padding: 20px; background: #f0fdf4; }
    .container { background: white; border-radius: 12px; padding: 30px; max-width: 700px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px; margin: -30px -30px 20px; }
    .info-row { padding: 15px; border-bottom: 1px solid #e5e7eb; display: flex; }
    .label { font-weight: 600; color: #374151; width: 180px; }
    .value { color: #111827; flex: 1; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
</style>

<div class="container">
    <div class="header">
        <h2 style="margin:0;">🔍 Información de RUC - DGI</h2>
    </div>
    
    <div class="info-row">
        <div class="label">RUC:</div>
        <div class="value"><strong>{{ruc}}</strong></div>
    </div>
    
    <div class="info-row">
        <div class="label">Dígito Verificador:</div>
        <div class="value"><strong>{{dv}}</strong></div>
    </div>
    
    <div class="info-row">
        <div class="label">Razón Social:</div>
        <div class="value">{{razonSocial}}</div>
    </div>
    
    <div class="info-row">
        <div class="label">Tipo de Contribuyente:</div>
        <div class="value">{{tipoRuc}}</div>
    </div>
    
    <div class="info-row">
        <div class="label">Status Factura Electrónica:</div>
        <div class="value">
            <span class="badge badge-success">{{afiliadoFE}}</span>
        </div>
    </div>
</div>
`;

pm.visualizer.set(template, {
    ruc: infoRuc['a:ruc'] || 'N/A',
    dv: infoRuc['a:dv'] || 'N/A',
    razonSocial: infoRuc['a:razonSocial'] || 'N/A',
    tipoRuc: infoRuc['a:tipoRuc'] === '2' ? 'Jurídico' : 'Natural',
    afiliadoFE: infoRuc['a:afiliadoFE'] || 'N/A'
});
```

---

## 📝 **TU SETUP ACTUAL ES CORRECTO:**

Todo lo que veo en tus capturas está perfectamente configurado:
- ✅ Endpoint correcto
- ✅ Headers correctos
- ✅ SOAP Action correcto
- ✅ XML bien formado
- ✅ Respuestas exitosas

Solo agregué los **visualizers mejorados** para que veas la data de forma más amigable.

---

## 💡 **PRÓXIMOS PASOS:**

1. Copia los scripts de arriba
2. Pégalos en el tab "Scripts" de cada request
3. Ejecuta el request
4. Click en "Visualize" para ver el resultado bonito

¿Quieres que te prepare los visualizers para los demás métodos (Enviar, EstadoDocumento, etc.)?
