'use client';

import { Plus, Pencil, Check, X, AlertCircle } from 'lucide-react';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Button } from '@shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { cn } from '@/lib/utils';
import { CPBSSelector } from '@/features/invoicing/ui/cpbs-selector';
import type { DocumentMode } from '@/shared/hooks/use-document-form';
import { ProductCombobox } from './product-combobox';
import type { FoundProduct } from './product-combobox';
import { TerceroFields } from './tercero-fields';

// ── Constants ────────────────────────────────────────────────────────────────

export const CPBS_UNITS = [
    { value: 'und', label: 'Unidad (und)' },
    { value: 'Mes', label: 'Mes' },
    { value: 'Hora', label: 'Hora' },
    { value: 'Día', label: 'Día' },
    { value: 'Actividad', label: 'Actividad' },
    { value: 'Viaje', label: 'Viaje' },
    { value: 'Persona', label: 'Persona' },
    { value: 'Paquete', label: 'Paquete' },
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'm', label: 'Metros (m)' },
    { value: 'm2', label: 'Metro Cuadrado (m²)' },
    { value: 'Año', label: 'Año' },
    { value: 'Visita', label: 'Visita' },
];

export const TASAS_ITBMS = [
    { value: '00', label: '0% (Exento)', rate: 0 },
    { value: '01', label: '7% (General)', rate: 0.07 },
    { value: '02', label: '10% (Bebidas/Hospedaje)', rate: 0.10 },
    { value: '03', label: '15% (Tabaco)', rate: 0.15 },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface CurrentItemState {
    descripcion: string;
    codigo: string;
    productId?: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    tasaITBMS: '00' | '01' | '02' | '03';
    cpbsCode: string;
    cpbsUnit: string;
    rucTercero?: string;
    numeroDocumentoTercero?: string;
}

interface ItemCardProps {
    currentItem: CurrentItemState;
    editingItemId: string | null;
    isGovernmentClient: boolean;
    itbmsForced: boolean;
    documentMode: DocumentMode;
    onFieldChange: (field: keyof CurrentItemState, value: unknown) => void;
    onAdd: () => void;
    onCancelEdit: () => void;
    isAddDisabled: boolean;
    productQuery: string;
    onProductQueryChange: (q: string) => void;
    onProductSelect: (p: FoundProduct) => void;
    isSearchingProducts: boolean;
    foundProducts: FoundProduct[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function ItemCard({
    currentItem,
    editingItemId,
    isGovernmentClient,
    itbmsForced,
    documentMode,
    onFieldChange,
    onAdd,
    onCancelEdit,
    isAddDisabled,
    productQuery,
    onProductQueryChange,
    onProductSelect,
    isSearchingProducts,
    foundProducts,
}: ItemCardProps) {
    const isEditing = !!editingItemId;

    return (
        <div className={cn(
            'border rounded-xl p-4 space-y-4',
            isEditing
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                : 'bg-gray-50 dark:bg-slate-900/30 border-gray-200 dark:border-slate-800'
        )}>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {isEditing
                    ? <><Pencil className="h-4 w-4 text-blue-500" /> Editando Item</>
                    : <><Plus className="h-4 w-4 text-purple-500" /> Agregar Nuevo Item</>
                }
            </h4>

            <div className="space-y-3">
                {/* Descripción */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-500 uppercase">Descripción *</Label>
                    <Textarea
                        value={currentItem.descripcion}
                        onChange={(e) => onFieldChange('descripcion', e.target.value)}
                        placeholder="Ej: Servicios Profesionales de Consultoría"
                        className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 min-h-[60px] resize-none"
                    />
                </div>

                {/* Inventory Search */}
                <ProductCombobox
                    value={productQuery}
                    onChange={onProductQueryChange}
                    onSelect={onProductSelect}
                    isSearching={isSearchingProducts}
                    products={foundProducts}
                />

                {/* Cantidad + Precio */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Cantidad *</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentItem.cantidad || ''}
                            onChange={(e) => onFieldChange('cantidad', parseFloat(e.target.value) || 0)}
                            placeholder="1"
                            className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Precio Unit. *</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={currentItem.precioUnitario || ''}
                                onChange={(e) => onFieldChange('precioUnitario', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="pl-7 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                            />
                        </div>
                    </div>
                </div>

                {/* CPBS fields (government clients) */}
                {isGovernmentClient && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="col-span-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase">Clasificación CPBS (Gobierno)</span>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase">Categoría CPBS *</Label>
                            <CPBSSelector
                                value={currentItem.cpbsCode}
                                onSelect={(code) => onFieldChange('cpbsCode', code)}
                                className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase">Unidad CPBS *</Label>
                            <Select
                                value={currentItem.cpbsUnit}
                                onValueChange={(val) => onFieldChange('cpbsUnit', val)}
                            >
                                <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800">
                                    <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {CPBS_UNITS.map(unit => (
                                        <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* Reembolso tercero fields */}
                {documentMode === 'REEMBOLSO' && (
                    <TerceroFields
                        rucTercero={currentItem.rucTercero ?? ''}
                        numeroDocumentoTercero={currentItem.numeroDocumentoTercero ?? ''}
                        onRucChange={(v) => onFieldChange('rucTercero', v)}
                        onNumeroChange={(v) => onFieldChange('numeroDocumentoTercero', v)}
                    />
                )}

                {/* Descuento + Tasa ITBMS */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Desc. Unit. ($)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={currentItem.descuento || ''}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (val <= currentItem.precioUnitario) {
                                        onFieldChange('descuento', val);
                                    }
                                }}
                                placeholder="0.00"
                                className="pl-7 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Tasa ITBMS *</Label>
                        {itbmsForced ? (
                            <div className="flex items-center h-10 px-3 rounded-md border border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400">
                                ITBMS: 0% (Exento automático)
                            </div>
                        ) : (
                            <Select
                                value={currentItem.tasaITBMS}
                                onValueChange={(value) => onFieldChange('tasaITBMS', value as '00' | '01' | '02' | '03')}
                            >
                                <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TASAS_ITBMS.map(tasa => (
                                        <SelectItem key={tasa.value} value={tasa.value}>{tasa.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    type="button"
                    onClick={onAdd}
                    disabled={isAddDisabled}
                    className={cn(
                        'flex-1',
                        isEditing
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white'
                    )}
                >
                    {isEditing
                        ? <><Check className="h-4 w-4 mr-2" /> Actualizar Item</>
                        : <><Plus className="h-4 w-4 mr-2" /> Agregar a la Factura</>
                    }
                </Button>
                {isEditing && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancelEdit}
                        className="border-gray-300 hover:bg-gray-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                    </Button>
                )}
            </div>
        </div>
    );
}
