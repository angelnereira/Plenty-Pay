'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { memo, useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Badge } from '@shared/ui/badge';
import { InvoiceActionButtons } from './invoice-action-buttons';

interface Invoice {
  id: string;
  folio?: string;
  invoiceNumber?: string;
  clientName?: string;
  receiverName?: string;
  clientRuc?: string;
  receiverRuc?: string;
  total: number;
  status: string;
  documentType?: string;
  cufe?: string;
  cafe?: string;
  createdAt: Date;
  emittedAt?: Date;
}

interface EnhancedInvoiceTableProps {
  invoices: Invoice[];
  filterStatus?: 'all' | 'recent' | 'certified' | 'draft' | 'processing' | 'error';
  onRefresh?: () => void;
}

import { cn } from '@/lib/utils';

// Componente de fila memoizado - solo re-renderiza si invoice o onRefresh cambian
const InvoiceTableRow = memo(function InvoiceTableRow({
  invoice,
  onRefresh,
  getStatusBadge,
}: {
  invoice: Invoice;
  onRefresh?: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const router = useRouter();

  const handleRowClick = () => {
    router.push(`/dashboard/facturas/${invoice.id}`);
  };

  return (
    <div 
      onClick={handleRowClick}
      className={cn(
        "grid grid-cols-7 gap-4 items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 transition-colors group cursor-pointer",
        (invoice.status === 'ERROR' || invoice.status === 'REJECTED')
          ? "bg-rose-50/50 dark:bg-rose-900/10 has-error hover:bg-rose-100/50 dark:hover:bg-rose-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      )}
    >
      <div className="font-medium truncate">
        <div className="flex items-center gap-1.5">
          {invoice.documentType === 'NOTA_CREDITO' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">NC</span>
          )}
          {invoice.documentType === 'NOTA_DEBITO' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">ND</span>
          )}
          <span>{invoice.folio || invoice.invoiceNumber || 'N/A'}</span>
        </div>
      </div>
      <div className="truncate">
        {invoice.clientName || invoice.receiverName || 'N/A'}
      </div>
      <div className="font-mono text-sm truncate">
        {invoice.clientRuc || invoice.receiverRuc || 'N/A'}
      </div>
      <div className="text-right font-semibold">
        ${invoice.total.toFixed(2)}
      </div>
      <div>{getStatusBadge(invoice.status)}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {format(new Date(invoice.createdAt), 'dd MMM yyyy', { locale: es })}
      </div>
      <div 
        className="flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        <InvoiceActionButtons
          invoice={{
            id: invoice.id,
            folio: invoice.folio,
            invoiceNumber: invoice.invoiceNumber,
            cufe: invoice.cufe,
            status: invoice.status,
          }}
          showView={true}
          showDownloadPDF={true}
          showDownloadXML={true}
          showCopyCUFE={true}
          showDelete={true}
          onActionComplete={onRefresh}
        />
      </div>
    </div>
  );
});

export function EnhancedInvoiceTable({
  invoices,
  filterStatus = 'all',
  onRefresh
}: EnhancedInvoiceTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Filtrar facturas según el estado seleccionado - memoizado
  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      switch (filterStatus) {
        case 'certified':
          return ['CERTIFIED', 'EMITTED', 'APPROVED'].includes(invoice.status);
        case 'draft':
          return invoice.status === 'DRAFT';
        case 'processing':
          return ['QUEUED', 'PROCESSING'].includes(invoice.status);
        case 'error':
          return ['ERROR', 'REJECTED'].includes(invoice.status);
        case 'recent':
          const dayAgo = new Date();
          dayAgo.setDate(dayAgo.getDate() - 1);
          return new Date(invoice.createdAt) > dayAgo;
        default:
          return true;
      }
    });
  }, [invoices, filterStatus]);

  // Virtualización - solo renderiza las filas visibles
  const rowVirtualizer = useVirtualizer({
    count: filteredInvoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Altura estimada de cada fila en px
    overscan: 5, // Filas extra a renderizar fuera del viewport
  });

  // Callback memoizado para badge de estado
  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case 'CERTIFIED':
      case 'EMITTED':
      case 'APPROVED':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Certificada
          </Badge>
        );
      case 'ERROR':
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Procesando
          </Badge>
        );
      case 'QUEUED':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            En Cola
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="secondary" className="gap-1 bg-gray-100 text-gray-500 hover:bg-gray-200">
            <XCircle className="h-3 w-3" />
            Cancelada
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Borrador
          </Badge>
        );
    }
  }, []);

  if (filteredInvoices.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No hay facturas para mostrar</p>
      </div>
    );
  }

  // Para listas pequeñas (<50 items), usar rendering normal
  // Para listas grandes, usar virtualización
  const useVirtualization = filteredInvoices.length > 50;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 gap-4 px-6 py-3.5 bg-slate-100/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Folio</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Cliente</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">RUC</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 text-right">Total</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Estado</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Fecha</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 text-right">Acciones</div>
      </div>

      {/* Body con virtualización condicional */}
      {useVirtualization ? (
        <div
          ref={parentRef}
          className="overflow-auto scrollbar-hide"
          style={{ height: '500px' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const invoice = filteredInvoices[virtualRow.index];
              return (
                <div
                  key={invoice.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <InvoiceTableRow
                    invoice={invoice}
                    onRefresh={onRefresh}
                    getStatusBadge={getStatusBadge}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // Rendering normal para listas pequeñas
        <div className="max-h-[500px] overflow-auto scrollbar-hide">
          {filteredInvoices.map((invoice) => (
            <InvoiceTableRow
              key={invoice.id}
              invoice={invoice}
              onRefresh={onRefresh}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

