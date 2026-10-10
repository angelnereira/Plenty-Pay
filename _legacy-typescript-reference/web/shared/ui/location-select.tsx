'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/ui/select';
import { PANAMA_LOCATIONS, getLocationName } from '@/lib/data/panama-locations';
import { Label } from '@shared/ui/label';

interface LocationSelectProps {
  value?: string; // Código en formato "P-D-C"
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

export function LocationSelect({ value, onChange, error, required }: LocationSelectProps) {
  // Parsear el valor actual
  const [provCode, distCode, corrCode] = value?.split('-') || ['', '', ''];

  const [selectedProvincia, setSelectedProvincia] = useState(provCode);
  const [selectedDistrito, setSelectedDistrito] = useState(distCode);
  const [selectedCorregimiento, setSelectedCorregimiento] = useState(corrCode);

  // Sincronizar el estado interno cuando el valor externo cambia (ej: form reset)
  useEffect(() => {
    const [newProvCode, newDistCode, newCorrCode] = value?.split('-') || ['', '', ''];
    setSelectedProvincia(newProvCode);
    setSelectedDistrito(newDistCode);
    setSelectedCorregimiento(newCorrCode);
  }, [value]);

  // Obtener distritos de la provincia seleccionada
  const distritos = useMemo(() => {
    if (!selectedProvincia) return [];
    const provincia = PANAMA_LOCATIONS.find(p => p.code === selectedProvincia);
    return provincia?.distritos || [];
  }, [selectedProvincia]);

  // Obtener corregimientos del distrito seleccionado
  const corregimientos = useMemo(() => {
    if (!selectedProvincia || !selectedDistrito) return [];
    const provincia = PANAMA_LOCATIONS.find(p => p.code === selectedProvincia);
    const distrito = provincia?.distritos.find(d => d.code === selectedDistrito);
    return distrito?.corregimientos || [];
  }, [selectedProvincia, selectedDistrito]);

  // Manejar cambio de provincia
  const handleProvinciaChange = (newProv: string) => {
    setSelectedProvincia(newProv);
    setSelectedDistrito('');
    setSelectedCorregimiento('');
    onChange(''); // Resetear el valor completo
  };

  // Manejar cambio de distrito
  const handleDistritoChange = (newDist: string) => {
    setSelectedDistrito(newDist);
    setSelectedCorregimiento('');
    onChange(''); // Resetear el valor completo
  };

  // Manejar cambio de corregimiento
  const handleCorregimientoChange = (newCorr: string) => {
    setSelectedCorregimiento(newCorr);
    const fullCode = `${selectedProvincia}-${selectedDistrito}-${newCorr}`;
    onChange(fullCode);
  };

  return (
    <div className="space-y-3">
      {/* Selector de Provincia */}
      <div className="space-y-2">
        <Label>
          Provincia {required && <span className="text-red-500">*</span>}
        </Label>
        <Select value={selectedProvincia} onValueChange={handleProvinciaChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccione provincia" />
          </SelectTrigger>
          <SelectContent>
            {PANAMA_LOCATIONS.map(prov => (
              <SelectItem key={prov.code} value={prov.code}>
                {prov.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selector de Distrito */}
      <div className="space-y-2">
        <Label>
          Distrito {required && <span className="text-red-500">*</span>}
        </Label>
        <Select
          value={selectedDistrito}
          onValueChange={handleDistritoChange}
          disabled={!selectedProvincia}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccione distrito" />
          </SelectTrigger>
          <SelectContent>
            {distritos.map(dist => (
              <SelectItem key={dist.code} value={dist.code}>
                {dist.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selector de Corregimiento */}
      <div className="space-y-2">
        <Label>
          Corregimiento {required && <span className="text-red-500">*</span>}
        </Label>
        <Select
          value={selectedCorregimiento}
          onValueChange={handleCorregimientoChange}
          disabled={!selectedDistrito}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccione corregimiento" />
          </SelectTrigger>
          <SelectContent>
            {corregimientos.map(corr => (
              <SelectItem key={corr.code} value={corr.code}>
                {corr.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mostrar código seleccionado (solo para debug/confirmación) */}
      {value && (
        <div className="text-sm text-muted-foreground">
          Código: <span className="font-mono">{value}</span>
          <br />
          {getLocationName(value)}
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
