'use client';

import { FileText } from 'lucide-react';
import type { UseDocumentFormReturn } from '@/shared/hooks/use-document-form';
import { TypeGrid } from './doc-type-step-v2/type-grid';
import { ExportFields } from './doc-type-step-v2/export-fields';
import { ImportFields } from './doc-type-step-v2/import-fields';
import { ReferenceSearch } from './doc-type-step-v2/reference-search';

// ── Props ────────────────────────────────────────────────────────────────────

interface DocTypeStepProps {
    form: UseDocumentFormReturn;
    onFetchReferencedItems: (invoice: NonNullable<UseDocumentFormReturn['referencedInvoice']>) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DocTypeStep({ form, onFetchReferencedItems }: DocTypeStepProps) {
    const {
        documentMode, setDocumentMode,
        noteSubtype, setNoteSubtype,
        noteReason, setNoteReason,
        referencedInvoice, selectReferencedInvoice,
        invoiceSearchQuery, setInvoiceSearchQuery,
        invoiceSearchResults, isSearchingInvoices,
        exportData, setExportData,
        importData, setImportData,
        isNoteMode, docLabel, needsExportFields,
    } = form;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Document Type Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Tipo de Documento Fiscal</h3>
                </div>

                <TypeGrid selected={documentMode} onSelect={setDocumentMode} />
            </div>

            {/* NC / ND: subtype + invoice search + motivo */}
            {isNoteMode && (documentMode === 'NOTA_CREDITO' || documentMode === 'NOTA_DEBITO') && (
                <ReferenceSearch
                    documentMode={documentMode}
                    docLabel={docLabel}
                    noteSubtype={noteSubtype}
                    onNoteSubtypeChange={setNoteSubtype}
                    searchQuery={invoiceSearchQuery}
                    onSearchQueryChange={setInvoiceSearchQuery}
                    searchResults={invoiceSearchResults}
                    isSearching={isSearchingInvoices}
                    selectedInvoice={referencedInvoice}
                    onSelectInvoice={selectReferencedInvoice}
                    onFetchReferencedItems={onFetchReferencedItems}
                    noteMotivo={noteReason}
                    onNoteMotivoChange={setNoteReason}
                />
            )}

            {/* Import fields */}
            {documentMode === 'FACTURA_IMPORTACION' && (
                <ImportFields value={importData} onChange={setImportData} />
            )}

            {/* Export fields (types 03 / 10) */}
            {needsExportFields && (
                <ExportFields value={exportData} onChange={setExportData} />
            )}
        </div>
    );
}
