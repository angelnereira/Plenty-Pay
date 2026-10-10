'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { searchProductsAction } from '@/actions/inventory-actions';
import { useDebounce } from '@shared/hooks/use-debounce';
import { SerializedProduct } from '@/features/inventory/model/types/inventory.types';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@shared/ui/table';
import { Card, CardContent } from '@shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@shared/ui/command';
import { CPBSSelector } from './cpbs-selector';

const CPBS_UNITS = [
    { value: 'und', label: 'Unidad (und)' },
    { value: 'Mes', label: 'Mes (Mes)' },
    { value: 'Hora', label: 'Hora (Hora)' },
    { value: 'Día', label: 'Día (Día)' },
    { value: 'Actividad', label: 'Actividad' },
    { value: 'Viaje', label: 'Viaje' },
    { value: 'Persona', label: 'Persona' },
    { value: 'Paquete', label: 'Paquete' },
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'm', label: 'Metros (m)' },
    { value: 'm2', label: 'Metro Cuadrado (m²)' },
];

export interface InvoiceItem {
    id: string;
    /** ID del producto en el módulo de inventario. Presente sólo cuando el ítem
     *  fue seleccionado desde el catálogo de productos. El backend usa este campo
     *  para descontar stock automáticamente al emitir la factura. */
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number; // quantity * unitPrice
    taxAmount: number; // subtotal * taxRate
    total: number; // subtotal + taxAmount
    cpbsCode?: string;
    cpbsUnit?: string;
}

interface ProductSelectorProps {
    items: InvoiceItem[];
    onItemsChange: (items: InvoiceItem[]) => void;
    isGovernment?: boolean;
}

export function ProductSelector({ items, onItemsChange, isGovernment }: ProductSelectorProps) {
    // Estado para el nuevo item que se está agregando
    const [newItem, setNewItem] = useState({
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0.07, // Default 7% ITBMS
        cpbsCode: '',
        cpbsUnit: '',
        productId: '' as string | undefined
    });

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [searchResults, setSearchResults] = useState<SerializedProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [openSearch, setOpenSearch] = useState(false);

    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearch || debouncedSearch.length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const result = await searchProductsAction(debouncedSearch);
                if (result.success) {
                    setSearchResults(result.data);
                }
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        };
        performSearch();
    }, [debouncedSearch]);

    const handleSelectProduct = (product: SerializedProduct) => {
        setNewItem({
            ...newItem,
            description: product.name,
            unitPrice: Number(product.salePrice),
            taxRate: product.taxRate ? Number(product.taxRate) / 100 : 0.07,
            cpbsCode: product.cpbsCode || '',
            cpbsUnit: product.cpbsUnit || '',
            productId: product.id
        });
        setOpenSearch(false);
        setSearchTerm('');
    };

    const handleAddItem = () => {
        if (!newItem.description || newItem.quantity <= 0 || newItem.unitPrice < 0) return;
        if (isGovernment && (!newItem.cpbsCode || !newItem.cpbsUnit)) {
            return;
        }

        const subtotal = newItem.quantity * newItem.unitPrice;
        const taxAmount = subtotal * newItem.taxRate;
        const total = subtotal + taxAmount;

        const item: InvoiceItem = {
            id: crypto.randomUUID(),
            description: newItem.description,
            quantity: newItem.quantity,
            unitPrice: newItem.unitPrice,
            taxRate: newItem.taxRate,
            subtotal,
            taxAmount,
            total,
            productId: newItem.productId,
            cpbsCode: newItem.cpbsCode || undefined,
            cpbsUnit: newItem.cpbsUnit || undefined
        };

        onItemsChange([...items, item]);

        // Reset form
        setNewItem({
            description: '',
            quantity: 1,
            unitPrice: 0,
            taxRate: 0.07,
            cpbsCode: '',
            cpbsUnit: '',
            productId: undefined
        });
    };

    const handleRemoveItem = (id: string) => {
        onItemsChange(items.filter(item => item.id !== id));
    };

    // Cálculos de totales generales
    const subtotalGeneral = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxGeneral = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalGeneral = items.reduce((sum, item) => sum + item.total, 0);

    return (
        <div className="space-y-6">
            {/* Formulario de Agregar Producto */}
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="desc">Descripción del Producto / Servicio</Label>
                                <Popover open={openSearch} onOpenChange={setOpenSearch}>
                                    <PopoverTrigger asChild>
                                        <Button variant="link" size="sm" className="h-6 px-2 text-violet-600 dark:text-violet-400 font-bold flex items-center gap-1">
                                            <Search className="h-3 w-3" /> Buscar en Catálogo
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command transition-style="in:wipe:down">
                                            <CommandInput 
                                                placeholder="Buscar por nombre o SKU..." 
                                                value={searchTerm}
                                                onValueChange={setSearchTerm}
                                            />
                                            <CommandList>
                                                <CommandEmpty>
                                                    {isSearching ? (
                                                        <div className="flex items-center justify-center p-4">
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            <span>Buscando...</span>
                                                        </div>
                                                    ) : (
                                                        searchTerm.length < 2 ? "Escribe 2 letras..." : "No se encontraron productos"
                                                    )}
                                                </CommandEmpty>
                                                <CommandGroup heading="Productos en Inventario">
                                                    {searchResults.map((p: SerializedProduct) => (
                                                        <CommandItem
                                                            key={p.id}
                                                            onSelect={() => handleSelectProduct(p)}
                                                            className="cursor-pointer"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-bold">{p.name}</span>
                                                                <div className="flex gap-2 text-[10px] text-muted-foreground uppercase font-black">
                                                                    <span>SKU: {p.sku || 'N/A'}</span>
                                                                    <span>•</span>
                                                                    <span>${Number(p.salePrice).toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Input
                                id="desc"
                                placeholder="Ej: Consultoría de Software"
                                value={newItem.description}
                                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="qty">Cantidad</Label>
                            <Input
                                id="qty"
                                type="number"
                                min="1"
                                value={newItem.quantity}
                                onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="price">Precio Unit.</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <Input
                                    id="price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="pl-7"
                                    value={newItem.unitPrice || ''}
                                    onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="tax">ITBMS</Label>
                            <Select
                                value={newItem.taxRate.toString()}
                                onValueChange={(val) => setNewItem({ ...newItem, taxRate: parseFloat(val) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0.07">7%</SelectItem>
                                    <SelectItem value="0.10">10%</SelectItem>
                                    <SelectItem value="0.15">15%</SelectItem>
                                    <SelectItem value="0">Exento (0%)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {isGovernment && (
                            <>
                                <div className="md:col-span-2 space-y-2">
                                    <Label>Categoría CPBS <span className="text-red-500">*</span></Label>
                                    <CPBSSelector
                                        value={newItem.cpbsCode}
                                        onSelect={(code) => {
                                            setNewItem({ ...newItem, cpbsCode: code });
                                        }}
                                        className="text-xs"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="cpbsUnit">Unid. CPBS <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={newItem.cpbsUnit}
                                        onValueChange={(val) => setNewItem({ ...newItem, cpbsUnit: val })}
                                    >
                                        <SelectTrigger id="cpbsUnit" className="text-xs">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CPBS_UNITS.map(unit => (
                                                <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        <div className="md:col-span-1">
                            <Button onClick={handleAddItem} disabled={!newItem.description || newItem.unitPrice <= 0 || (isGovernment === true && (!newItem.cpbsCode || !newItem.cpbsUnit))} className="w-full">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla de Items */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[40%]">Descripción</TableHead>
                            <TableHead className="text-right">Cant.</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="text-right">ITBMS</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No hay items agregados. Usa el formulario de arriba para agregar productos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        {item.description}
                                        {item.cpbsCode && <span className="block text-xs text-muted-foreground mt-0.5">CPBS: {item.cpbsCode} ({item.cpbsUnit})</span>}
                                    </TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{(item.taxRate * 100).toFixed(0)}%</TableCell>
                                    <TableCell className="text-right font-bold">${item.total.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Totales */}
            {items.length > 0 && (
                <div className="flex justify-end">
                    <Card className="w-full md:w-1/3 bg-muted/20">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span>${subtotalGeneral.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ITBMS:</span>
                                <span>${taxGeneral.toFixed(2)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-bold text-lg pt-2">
                                <span>Total:</span>
                                <span className="text-primary">${totalGeneral.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function Separator() {
    return <div className="h-[1px] w-full bg-border my-2" />;
}
