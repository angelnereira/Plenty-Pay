'use client';

import { useState, useEffect } from 'react';
import { searchProductsAction } from '@/actions/inventory-actions';
import type { UseDocumentFormReturn } from '@/shared/hooks/use-document-form';
import type { UseInvoiceItemsReturn, AddItemInput } from '@/shared/hooks/use-invoice-items';
import {
    ItemCard,
    TotalsStickyPanel,
    ReferencedNoteView,
    ReferencedLoadingStates,
    ItemsList,
} from './items-step-v2';
import type { CurrentItemState, FoundProduct } from './items-step-v2';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CURRENT_ITEM: CurrentItemState = {
    descripcion: '',
    codigo: '',
    productId: undefined,
    cantidad: 1,
    precioUnitario: 0,
    descuento: 0,
    tasaITBMS: '01',
    cpbsCode: '',
    cpbsUnit: '',
    rucTercero: '',
    numeroDocumentoTercero: '',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface ItemsStepProps {
    form: UseDocumentFormReturn;
    items: UseInvoiceItemsReturn;
    itemsFetchStatus: 'idle' | 'loading' | 'done' | 'error';
    onRetryFetch: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ItemsStep({ form, items, itemsFetchStatus, onRetryFetch }: ItemsStepProps) {
    const { documentMode, isNoteReferenced, referencedInvoice, clientData } = form;
    const isGovernmentClient = clientData.tipoClienteFE === '03';
    const itbmsForced = documentMode === 'FACTURA_EXPORTACION' || documentMode === 'FACTURA_ZONA_FRANCA';

    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [currentItem, setCurrentItem] = useState<CurrentItemState>(DEFAULT_CURRENT_ITEM);
    const [productQuery, setProductQuery] = useState('');
    const [foundProducts, setFoundProducts] = useState<FoundProduct[]>([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    useEffect(() => {
        if (productQuery.length <= 2) { setFoundProducts([]); return; }
        const timer = setTimeout(async () => {
            setIsSearchingProducts(true);
            const result = await searchProductsAction(productQuery);
            if (result.success) setFoundProducts(result.data || []);
            setIsSearchingProducts(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [productQuery]);

    const handleFieldChange = (field: keyof CurrentItemState, value: unknown) => {
        setCurrentItem(prev => ({ ...prev, [field]: value }));
    };

    const handleProductSelect = (p: FoundProduct) => {
        setCurrentItem(prev => ({
            ...prev,
            descripcion: p.name,
            codigo: p.sku || `PROD-${p.id}`,
            productId: p.id,
            precioUnitario: Number(p.salePrice),
            tasaITBMS: (['00', '01', '02', '03'] as const).includes(p.taxCode as '00' | '01' | '02' | '03') ? p.taxCode as '00' | '01' | '02' | '03' : '01',
            cpbsCode: p.cpbsCode || '',
            cpbsUnit: p.cpbsUnit || '',
        }));
        setProductQuery('');
        setFoundProducts([]);
    };

    const handleAddItem = () => {
        const input: AddItemInput = {
            codigo: currentItem.codigo,
            descripcion: currentItem.descripcion,
            cantidad: currentItem.cantidad,
            precioUnitario: currentItem.precioUnitario,
            descuento: currentItem.descuento,
            tasaITBMS: itbmsForced ? '00' : currentItem.tasaITBMS,
            productId: currentItem.productId,
            cpbsCode: currentItem.cpbsCode || undefined,
            cpbsUnit: currentItem.cpbsUnit || undefined,
            rucTercero: currentItem.rucTercero || undefined,
            numeroDocumentoTercero: currentItem.numeroDocumentoTercero || undefined,
        };
        if (editingItemId) {
            items.updateItem(editingItemId, input);
            setEditingItemId(null);
        } else {
            items.addItem(input);
        }
        setCurrentItem(DEFAULT_CURRENT_ITEM);
        setProductQuery('');
        setFoundProducts([]);
    };

    const handleEditItem = (id: string) => {
        const item = items.items.find(i => i.id === id);
        if (!item) return;
        setCurrentItem({
            descripcion: item.descripcion,
            codigo: item.codigo,
            productId: item.productId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            descuento: item.precioUnitario - item.precioUnitarioDescuento,
            tasaITBMS: item.tasaITBMS,
            cpbsCode: item.cpbsCode || '',
            cpbsUnit: item.cpbsUnit || '',
            rucTercero: item.rucTercero ?? '',
            numeroDocumentoTercero: item.numeroDocumentoTercero ?? '',
        });
        setEditingItemId(id);
    };

    const isAddDisabled =
        !currentItem.descripcion ||
        currentItem.cantidad <= 0 ||
        currentItem.precioUnitario < 0 ||
        (isGovernmentClient && (!currentItem.cpbsCode || currentItem.cpbsCode.length !== 4 || !currentItem.cpbsUnit));

    // ── Referenced NC/ND: loading / error ───────────────────────────────────
    if (isNoteReferenced && referencedInvoice && items.items.length === 0 &&
        (itemsFetchStatus === 'loading' || itemsFetchStatus === 'error')) {
        return (
            <ReferencedLoadingStates
                documentMode={documentMode}
                referencedInvoice={referencedInvoice}
                onRetryFetch={onRetryFetch}
                status={itemsFetchStatus as 'loading' | 'error'}
            />
        );
    }

    // ── Referenced NC/ND: auto-loaded items view ─────────────────────────────
    if (isNoteReferenced && referencedInvoice && items.items.length > 0) {
        return <ReferencedNoteView documentMode={documentMode} referencedInvoice={referencedInvoice} items={items} />;
    }

    // ── Standard items form — 2-column layout ───────────────────────────────
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 space-y-4">
                <ItemsList
                    items={items.items}
                    editingItemId={editingItemId}
                    onEdit={handleEditItem}
                    onRemove={items.removeItem}
                />
                <ItemCard
                    currentItem={currentItem}
                    editingItemId={editingItemId}
                    isGovernmentClient={isGovernmentClient}
                    itbmsForced={itbmsForced}
                    documentMode={documentMode}
                    onFieldChange={handleFieldChange}
                    onAdd={handleAddItem}
                    onCancelEdit={() => { setEditingItemId(null); setCurrentItem(DEFAULT_CURRENT_ITEM); }}
                    isAddDisabled={isAddDisabled}
                    productQuery={productQuery}
                    onProductQueryChange={setProductQuery}
                    onProductSelect={handleProductSelect}
                    isSearchingProducts={isSearchingProducts}
                    foundProducts={foundProducts}
                />
            </div>
            <TotalsStickyPanel totals={items.totals} itemCount={items.items.length} />
        </div>
    );
}
