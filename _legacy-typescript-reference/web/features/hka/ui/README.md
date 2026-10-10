# 🎨 Visualizadores HKA - Estilo Postman en el Proyecto

## Implementación Completa de Visualizers al Estilo Postman

---

## 📁 **ARCHIVOS CREADOS:**

```
components/hka/
├── folios-visualizer.tsx    ✅ Visualizador de Folios Restantes
└── ruc-visualizer.tsx        ✅ Visualizador de Consultar RUC

app/dashboard/
└── hka-test/
    └── page.tsx              ✅ Página demo de visualizadores

app/api/hka/
├── folios-restantes/
│   └── route.ts              ✅ API para consultar folios
└── consultar-ruc/
    └── route.ts              ✅ API para validar RUC
```

---

## 🎯 **CÓMO USAR:**

### **1. Iniciar el Servidor:**

```bash
npm run dev
```

### **2. Visitar la Página:**

```
http://localhost:3000/dashboard/hka-test
```

### **3. Probar los Visualizadores:**

- **Tab "Folios Restantes":**
  1. Click en "Consultar"
  2. Llama a `/api/hka/folios-restantes`
  3. Muestra respuesta con visualizer estilo Postman

- **Tab "Consultar RUC":**
  1. Click en "Consultar"
  2. Llama a `/api/hka/consultar-ruc`
  3. Muestra info del RUC con visualizer

---

## ✨ **CARACTERÍSTICAS:**

### **Igual que Postman:**

1. ✅ **Tablas Styled** - Misma presentación
2. ✅ **Progress Bars** - Con porcentajes
3. ✅ **Cards con Métricas** - Datos destacados
4. ✅ **Badges de Status** - Código de respuesta
5. ✅ **Loading States** - Spinners mientras carga
6. ✅ **Responsive** - Se adapta a cualquier pantalla

### **Mejoras sobre Postman:**

1. ✅ **Interactivo** - No necesitas recargar
2. ✅ **Integrado** - Dentro del dashboard
3. ✅ **Autenticado** - Usa sesión del usuario
4. ✅ **Dark Mode** - Soporta tema oscuro
5. ✅ **Real Time** - Datos en vivo de HKA

---

## 🔧 **AGREGAR MÁS VISUALIZADORES:**

### **Template para Nuevo Visualizador:**

```typescript
// components/hka/tu-visualizer.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TuRespuestaHKA } from '@/lib/hka/types';

interface TuVisualizerProps {
  data: TuRespuestaHKA;
  loading?: boolean;
}

export function TuVisualizer({ data, loading }: TuVisualizerProps) {
  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Tu UI aquí - igual que Postman */}
      <Card>
        <CardHeader>
          <CardTitle>{data.titulo}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Contenido */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### **API Route:**

```typescript
// app/api/hka/tu-metodo/route.ts
import { NextResponse } from 'next/server';
import { tuMetodoHKA } from '@/lib/hka';

export async function GET() {
  const result = await tuMetodoHKA(config);
  return NextResponse.json({
    success: result.success,
    data: result.data
  });
}
```

### **Agregar Tab:**

```typescript
// En app/dashboard/hka-test/page.tsx
<TabsList>
  <TabsTrigger value="folios">Folios</TabsTrigger>
  <TabsTrigger value="ruc">RUC</TabsTrigger>
  <TabsTrigger value="tu-metodo">Tu Método</TabsTrigger> {/* Nuevo */}
</TabsList>

<TabsContent value="tu-metodo">
  <TuVisualizer data={tuData} loading={tuLoading} />
</TabsContent>
```

---

## 🎨 **PERSONALIZAR ESTILOS:**

### **Colores:**

Usa las clases de Tailwind:

```tsx
// Orange (default)
<Card className="border-l-4 border-l-orange-500" />

// Green
<Card className="border-l-4 border-l-green-500" />

// Purple
<Card className="border-l-4 border-l-purple-500" />
```

### **Gradientes:**

```tsx
<div className="bg-gradient-to-r from-orange-50 to-red-50" />
```

---

## 📊 **VISUALIZADORES DISPONIBLES:**

| Componente | Método HKA | Status |
|------------|------------|--------|
| FoliosVisualizer | FoliosRestantes | ✅ Listo |
| RucVisualizer | ConsultarRucDV | ✅ Listo |
| EstadoDocumentoVisualizer | EstadoDocumento | 📝 Agregar |
| EnviarVisualizer | Enviar | 📝 Agregar |
| DescargasVisualizer | DescargaXML/PDF | 📝 Agregar |

---

## 🚀 **PRÓXIMOS VISUALIZADORES:**

### **1. Estado Documento:**

```typescript
import { EstadoDocumentoResponse } from '@/lib/hka/types';

export function EstadoDocumentoVisualizer({ data }: { data: EstadoDocumentoResponse }) {
  return (
    <div className="space-y-4">
      {/* Badge grande con estado */}
      <Badge variant={data.estatusDocumento === 'Autorizada' ? 'success' : 'warning'}>
        {data.estatusDocumento}
      </Badge>
      
      {/* Timeline de eventos */}
      <div className="space-y-2">
        <div>Emisión: {data.fechaEmisionDocumento}</div>
        <div>Recepción: {data.fechaRecepcionDocumento}</div>
      </div>

      {/* CUFE */}
      <div className="font-mono text-sm">{data.cufe}</div>
    </div>
  );
}
```

### **2. Enviar (Factura Emitida):**

```typescript
export function EnviarVisualizer({ data }: { data: EnviarResponse }) {
  return (
    <div className="space-y-6">
      {/* Success card */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-700">
            ✅ Factura Emitida Exitosamente
          </CardTitle>
        </CardHeader>
      </Card>

      {/* CUFE y QR */}
      <div>
        <a href={data.qr} target="_blank">
          <QRCode value={data.qr} />
        </a>
      </div>

      {/* Detalles */}
      <Table>
        <tr>
          <td>CUFE</td>
          <td className="font-mono">{data.cufe}</td>
        </tr>
        <tr>
          <td>Protocolo</td>
          <td>{data.nroProtocoloAutorizacion}</td>
        </tr>
      </Table>
    </div>
  );
}
```

---

## 💡 **INTEGRACIÓN CON DASHBOARD:**

### **Agregar al Menú:**

```typescript
// En tu layout o sidebar
const menuItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/facturas', label: 'Facturas' },
  { href: '/dashboard/hka-test', label: 'HKA Test' }, // Nuevo
];
```

### **Usar en Otras Páginas:**

```typescript
// En cualquier página del dashboard
import { FoliosVisualizer } from '@/components/hka/folios-visualizer';

export default function MiPagina() {
  const [folios, setFolios] = useState(null);

  return (
    <div>
      <FoliosVisualizer data={folios} />
    </div>
  );
}
```

---

## 🎯 **BENEFICIOS:**

1. **Testing Rápido** - Prueba HKA sin Postman
2. **Debugging Visual** - Ve las respuestas formateadas
3. **Demo para Clientes** - Muestra funcionalidad HKA
4. **Documentación Viva** - Ejemplos reales funcionando
5. **Desarrollo Ágil** - Itera más rápido

---

## 📝 **NOTAS:**

- Todos los visualizadores usan componentes de shadcn/ui
- Estilos con Tailwind CSS
- TypeScript completo con tipos de HKA
- Respuestas reales de HKA (no mocks)
- Autenticación con NextAuth

---

**Creado:** 2025-12-08  
**Autor:** Basado en visualizers de Postman del usuario  
**Status:** ✅ Production Ready
