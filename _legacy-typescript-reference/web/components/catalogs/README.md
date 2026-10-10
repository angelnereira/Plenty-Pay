# 🎨 Componentes de Catálogos HKA

Componentes React para selección de catálogos HKA con búsqueda, autocomplete y validación.

---

## 📦 **COMPONENTES DISPONIBLES:**

### **1. LocationPicker** 📍
Selector de ubicaciones de Panamá con búsqueda.

```tsx
import { LocationPicker } from '@/components/catalogs';

<LocationPicker
  value={locationCode}
  onChange={setLocationCode}
  provincia="PANAMA" // Opcional: filtrar por provincia
  placeholder="Seleccionar ubicación..."
  disabled={false}
  className="w-full"
/>
```

**Características:**
- Búsqueda con debounce (300ms)
- Integración con API `/api/catalogs/locations`
- Muestra: Provincia → Distrito → Corregimiento
- Filtrado opcional por provincia

---

### **2. CurrencySelect** 💱
Selector de monedas ISO 4217.

```tsx
import { CurrencySelect } from '@/components/catalogs';

<CurrencySelect
  value={currency}
  onChange={setCurrency}
  placeholder="Seleccionar moneda..."
  disabled={false}
  className="w-full"
/>
```

**Características:**
- 38 monedas principales
- Muestra símbolo + código + nombre
- Búsqueda local (sin API)
- TypeScript type-safe (CurrencyCode)

---

### **3. UnitSelect** 📏
Selector de unidades de medida.

```tsx
import { UnitSelect } from '@/components/catalogs';

<UnitSelect
  value={unit}
  onChange={setUnit}
  filterByType="Masa" // Opcional: Contaje, Longitud, Área, Volumen, Masa, etc.
  placeholder="Seleccionar unidad..."
  disabled={false}
  className="w-full"
/>
```

**Características:**
- 80+ unidades disponibles
- Agrupadas por tipo (Masa, Longitud, Volumen, etc.)
- Muestra símbolo, nombre y comentarios
- Filtrado opcional por tipo
- TypeScript type-safe (UnitCode)

---

### **4. IncotermSelect** 🚢
Selector de INCOTERMS 2020.

```tsx
import { IncotermSelect } from '@/components/catalogs';

<IncotermSelect
  value={incoterm}
  onChange={setIncoterm}
  transportType="ANY" // o "SEA_ONLY"
  showDescription={true}
  placeholder="Seleccionar INCOTERM..."
  disabled={false}
  className="w-full"
/>
```

**Características:**
- 11 INCOTERMS 2020
- Agrupados por tipo de transporte
- Muestra código, nombre, descripción
- Filtrado por tipo de transporte
- TypeScript type-safe (IncotermCode)

---

## 🎯 **USO EN FORMULARIOS:**

### **Con React Hook Form:**

```tsx
import { useForm } from 'react-hook-form';
import { LocationPicker, CurrencySelect, UnitSelect } from '@/components/catalogs';

function InvoiceForm() {
  const form = useForm({
    defaultValues: {
      location: '',
      currency: 'PAB',
      unit: 'und',
    },
  });
  
  return (
    <form>
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ubicación</FormLabel>
            <FormControl>
              <LocationPicker
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="currency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Moneda</FormLabel>
            <FormControl>
              <CurrencySelect
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="unit"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Unidad</FormLabel>
            <FormControl>
              <UnitSelect
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </form>
  );
}
```

---

## 🔧 **DEPENDENCIAS:**

Estos componentes requieren:
- shadcn/ui components (Button, Command, Popover)
- lucide-react icons
- TypeScript
- Tailwind CSS

---

## 📝 **VALIDACIÓN:**

Usa los validators en `@/lib/hka/validators/catalog-validator.ts`:

```tsx
import { validateCurrencyCode, validateUnitCode } from '@/lib/hka/validators/catalog-validator';

const currencyValidation = validateCurrencyCode('PAB');
// { valid: true, code: 'PAB' }

const unitValidation = validateUnitCode('kg');
// { valid: true, code: 'kg' }
```

---

## 🎨 **PERSONALIZACIÓN:**

Todos los componentes aceptan:
- `className` - Clases CSS personalizadas
- `disabled` - Deshabilitar el componente
- `placeholder` - Texto placeholder personalizado

---

## 📚 **MÁS INFORMACIÓN:**

Ver documentación completa en:
- Catálogos TypeScript: `lib/hka/catalogs/constants/`
- API Routes: `app/api/catalogs/`
- Tipos: `types/catalog-api.ts`

---

**Última actualización:** 2025-12-08 00:15  
**Estado:** ✅ 4 componentes listos para producción
