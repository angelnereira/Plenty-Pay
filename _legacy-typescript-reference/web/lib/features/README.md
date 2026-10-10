# Feature-Based Architecture - Quick Start

## 🎯 Arquitectura Implementada

PlentyPay ahora usa **arquitectura modular por dominios** adaptada a Next.js.

---

## 📂 Estructura

```
lib/
├── features/          # Features por dominio
│   └── invoicing/    # Ejemplo completo
├── shared/            # Utilidades compartidas
└── config/            # Configuración

app/api/
└── invoices-v2/      # API Routes ejemplo
```

---

## Crear Nuevo Feature (5 pasos)

### 1. Estructura:
```bash
mkdir -p lib/features/my-feature/{services,repositories,types}
```

### 2. Types:
```typescript
// lib/features/my-feature/types/my-feature.types.ts
export interface MyEntity {
  id: string;
  name: string;
}
```

### 3. Repository:
```typescript
// lib/features/my-feature/repositories/my-feature.repository.ts
export class MyFeatureRepository {
  async create(data) { /* Prisma */ }
  async findById(id) { /* Prisma */ }
}
```

### 4. Service:
```typescript
// lib/features/my-feature/services/my-feature.service.ts
export class MyFeatureService {
  constructor(private repo = new MyFeatureRepository()) {}
  
  async doSomething() {
    // Lógica de negocio
  }
}
```

### 5. Barrel Export:
```typescript
// lib/features/my-feature/index.ts
export * from './services/my-feature.service';
export type * from './types/my-feature.types';
```

---

## 💡 Usar en API Route

```typescript
// app/api/my-resource/route.ts
import { MyFeatureService } from '@/lib/features/my-feature';

export async function GET() {
  const service = new MyFeatureService();
  const result = await service.doSomething();
  return Response.json(result);
}
```

---

## Ejemplo Completo

Ver:
- `lib/features/invoicing/` - Feature completo
- `app/api/invoices-v2/` - API Routes usando el feature
- `docs/ARCHITECTURE.md` - Documentación detallada

---

## 📖 Docs Completa

Lee `docs/ARCHITECTURE.md` para:
- Principios arquitectónicos
- Patrones de diseño
- Guías de testing
- Migración de features existentes
