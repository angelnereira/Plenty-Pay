# CPBS: Reglas de Implementación y Arquitectura

Este documento consolida las reglas de validación obligatoria, las implicaciones en base de datos y la arquitectura técnica para manejar los códigos de la Codificación Panameña de Bienes y Servicios (CPBS) con The Factory HKA.

## 1. La Raíz del Problema y Reglas de Obligatoriedad

El error de validación *"El campo codigoCPBS es requerido"* ocurre porque los códigos CPBS son **obligatorios** cuando se factura a una entidad gubernamental en Panamá.

La validación es bloqueante ante la DGI y el PAC y se ejecuta nivel `ser:item` dentro del XML.

**Obligatoriedad según Cliente:**

| tipoClienteFE | Tipo de Cliente | codigoCPBS (C10) | unidadMedidaCPBS |
| :--- | :--- | :--- | :--- |
| `01` | Contribuyente | Opcional | Opcional |
| `02` | Consumidor Final | Opcional | Opcional |
| `03` | Gobierno | **OBLIGATORIO** | **OBLIGATORIO** |
| `04` | Extranjero | Opcional | Opcional |

## 2. Estructura de la CPBS

El sistema se basa en UNSPSC. En Panamá se requieren solo dos niveles:

- **Segmento (2 dígitos)**: El código corto (C09 - `codigoCPBSAbrev`).
- **Familia (4 dígitos)**: El código completo (C10 - `codigoCPBS`).

> **Regla de Derivación Automática:** El código de Segmento siempre corresponde a los **dos primeros dígitos** del código de Familia (Ej. Si `codigoCPBS = "8010"`, el `codigoCPBSAbrev = "80"`). El sistema no necesita pedirle ambos datos al usuario.

## 3. Mapeo en el Generador XML (HKA)

Al construir cada ítem (`<ser:item>`), se debe inyectar las etiquetas de CPBS (sólo si es obligatorio o el producto las incluye).

```xml
<ser:item>
  <ser:descripcion>Alquiler de local comercial</ser:descripcion>
  <ser:codigo>ALQ-001</ser:codigo>
  <ser:unidadMedida>und</ser:unidadMedida>
  <ser:cantidad>1.00</ser:cantidad>
  
  <!-- Campos CPBS -->
  <ser:codigoCPBSAbrev>80</ser:codigoCPBSAbrev>
  <ser:codigoCPBS>8013</ser:codigoCPBS>
  <ser:unidadMedidaCPBS>Mes</ser:unidadMedidaCPBS>
  
  <!-- Siguen los campos estándar -->
</ser:item>
```

## 4. Implicaciones de Arquitectura para PlentyPay

Para eludir completamente el error, es necesario implementar una solución cohesiva que empiece en el nivel de Producto/Inventario y baje hasta la Factura.

### Cambios a Nivel Base de Datos

1. **Tabla de Catálogo Global**: `cpbs_catalog` para alimentar la interfaz con opciones predefinidas.
2. **Productos**: Extender el modelo `Product` con `cpbsCode` y `cpbsUnitMeasure`. De esta manera, al catalogar un ítem, el usuario decide si incluir su correspondiente CPBS.
3. **Detalles de Factura**: Extender el modelo `InvoiceItem` con `cpbsCode` y `cpbsUnitMeasure`. De modo que si un producto se escoge para facturar, arrastre los códigos.

### Flujo Técnico

- **Al agregar un producto al Carrito / Factura**: Arrastrar los valores `cpbsCode` y `cpbsUnitMeasure` hacia el ítem.
- **Antes de Emitir (Facturación)**: Evaluar el tipo de cliente (`tipoClienteFE`). Si es `03`, lanzar un error interceptado *antes* de llamar al servicio HKA, informando de forma transparente al usuario que requiere rellenar los valores CPBS de ciertos ítems.
- **En la Traducción a XML**: Mapear `cpbsCode` como `<ser:codigoCPBS>` e inyectar `<ser:codigoCPBSAbrev>` autoderivado.
