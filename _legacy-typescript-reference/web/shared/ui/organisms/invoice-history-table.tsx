'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@shared/ui/atoms/status-badge';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import {
  Download,
  FileText,
  Mail,
  XCircle,
  Eye,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@shared/ui/dropdown-menu';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  folio: string;
  clientName: string;
  clientRuc: string;
  total: number;
  status: string;
  cufe?: string;
  createdAt: Date;
  emittedAt?: Date;
}

interface InvoiceHistoryTableProps {
  invoices: Invoice[];
  onViewDetails?: (invoice: Invoice) => void;
  onDownloadPDF?: (invoice: Invoice) => void;
  onDownloadXML?: (invoice: Invoice) => void;
  onSendEmail?: (invoice: Invoice) => void;
  onCancel?: (invoice: Invoice) => void;
  className?: string;
}

/**
 * Componente Mobile Card: Muestra factura en formato de tarjeta para móviles
 */
function InvoiceMobileCard({
  invoice,
  onViewDetails,
  onDownloadPDF,
  onDownloadXML,
  onSendEmail,
  onCancel,
}: {
  invoice: Invoice;
  onViewDetails: (invoice: Invoice) => void;
  onDownloadPDF: (invoice: Invoice) => void;
  onDownloadXML: (invoice: Invoice) => void;
  onSendEmail: (invoice: Invoice) => void;
  onCancel: (invoice: Invoice) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header compacto - siempre visible */}
      <div className="p-4 space-y-3">
        {/* Primera fila: Folio y Estado */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Folio
            </div>
            <div className="font-mono font-bold text-gray-900 dark:text-white truncate">
              {invoice.folio}
            </div>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Segunda fila: Cliente */}
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Cliente
          </div>
          <div className="font-medium text-gray-900 dark:text-white">
            {invoice.clientName}
          </div>
        </div>

        {/* Tercera fila: Total y Fecha */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Total
            </div>
            <div className="font-bold text-lg text-gray-900 dark:text-white font-mono">
              ${invoice.total.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Fecha
            </div>
            <div className="text-sm text-gray-900 dark:text-white">
              {format(invoice.createdAt, 'dd MMM yyyy', { locale: es })}
            </div>
          </div>
        </div>

        {/* Botón para expandir detalles */}
        {invoice.status === 'EMITTED' && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 py-2 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {isExpanded ? 'Ocultar acciones' : 'Ver acciones'}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Sección expandible con acciones - solo para EMITTED */}
      {isExpanded && invoice.status === 'EMITTED' && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => onViewDetails(invoice)}
              className="gap-2 h-11"
            >
              <Eye className="h-5 w-5" />
              Ver detalles
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => onDownloadPDF(invoice)}
              className="gap-2 h-11 text-red-600 border-red-200 hover:bg-red-50"
            >
              <FileText className="h-5 w-5" />
              PDF
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => onDownloadXML(invoice)}
              className="gap-2 h-11 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <Download className="h-5 w-5" />
              XML
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => onSendEmail(invoice)}
              className="gap-2 h-11 text-green-600 border-green-200 hover:bg-green-50"
            >
              <Mail className="h-5 w-5" />
              Email
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => onCancel(invoice)}
              className="gap-2 h-11 col-span-2 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <XCircle className="h-5 w-5" />
              Anular factura
            </Button>
          </div>
        </div>
      )}

      {/* Botón Ver detalles siempre visible para estados no emitted */}
      {invoice.status !== 'EMITTED' && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onViewDetails(invoice)}
            className="gap-2 h-11 w-full"
          >
            <Eye className="h-5 w-5" />
            Ver detalles
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Componente Organism: InvoiceHistoryTable
 *
 * Tabla completa de historial de facturas con:
 * - Búsqueda y filtrado
 * - Acciones rápidas (PDF, XML, Email, Anulación)
 * - Estado de documento con colores
 * - Rastreo de correo
 * - Paginación
 * - Vista de tarjetas para móviles (< 768px)
 */
export function InvoiceHistoryTable({
  invoices,
  onViewDetails,
  onDownloadPDF,
  onDownloadXML,
  onSendEmail,
  onCancel,
  className,
}: InvoiceHistoryTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Handlers por defecto
  const handleViewDetails = onViewDetails || ((invoice: Invoice) => {
    router.push(`/dashboard/facturas/${invoice.id}`);
  });

  const handleDownloadPDF = onDownloadPDF || (async (invoice: Invoice) => {
    toast.info('Descargando PDF...');
    // TODO: Implementar descarga real
  });

  const handleDownloadXML = onDownloadXML || (async (invoice: Invoice) => {
    toast.info('Descargando XML...');
    // TODO: Implementar descarga real
  });

  const handleSendEmail = onSendEmail || (async (invoice: Invoice) => {
    toast.info('Enviando email...');
    // TODO: Implementar envío real
  });

  const handleCancel = onCancel || (async (invoice: Invoice) => {
    toast.info('Anulando factura...');
    // TODO: Implementar anulación real
  });

  // Filtrar facturas
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.clientRuc.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Paginación
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por folio, cliente o RUC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Estado: {statusFilter === 'all' ? 'Todos' : statusFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('EMITTED')}>
              Emitidos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('APPROVED')}>
              Aprobados
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('REJECTED')}>
              Rechazados
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('DRAFT')}>
              Borradores
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Vista de tarjetas para móviles (< md breakpoint) */}
      <div className="md:hidden space-y-3">
        {paginatedInvoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            No se encontraron facturas
          </div>
        ) : (
          paginatedInvoices.map((invoice) => (
            <InvoiceMobileCard
              key={invoice.id}
              invoice={invoice}
              onViewDetails={handleViewDetails}
              onDownloadPDF={handleDownloadPDF}
              onDownloadXML={handleDownloadXML}
              onSendEmail={handleSendEmail}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>

      {/* Tabla para desktop (>= md breakpoint) */}
      <div className="hidden md:block border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  Folio
                </th>
                <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  Cliente
                </th>
                <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  RUC
                </th>
                <th className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">
                  Total
                </th>
                <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  Estado
                </th>
                <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">
                  Fecha
                </th>
                <th className="p-3 text-center font-medium text-gray-700 dark:text-gray-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron facturas
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-3">
                      <span className="font-mono font-medium text-gray-900 dark:text-white">
                        {invoice.folio}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {invoice.clientName}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-gray-600 dark:text-gray-400">
                        {invoice.clientRuc}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-semibold text-gray-900 dark:text-white font-mono">
                        ${invoice.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="text-gray-900 dark:text-white">
                          {format(invoice.createdAt, 'dd MMM yyyy', { locale: es })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {format(invoice.createdAt, 'HH:mm', { locale: es })}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => handleViewDetails(invoice)}
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {invoice.status === 'EMITTED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDownloadPDF(invoice)}
                            title="Descargar PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}

                        {invoice.status === 'EMITTED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => handleDownloadXML(invoice)}
                            title="Descargar XML"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        {invoice.status === 'EMITTED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => handleSendEmail(invoice)}
                            title="Enviar por email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}

                        {invoice.status === 'EMITTED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                            onClick={() => handleCancel(invoice)}
                            title="Anular"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
            Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredInvoices.length)} de{' '}
            {filteredInvoices.length} facturas
          </div>

          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-10"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Anterior</span>
            </Button>

            {/* Mostrar solo algunas páginas en móvil */}
            <div className="hidden md:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-9 h-9"
                >
                  {page}
                </Button>
              ))}
            </div>

            {/* Indicador de página en móvil */}
            <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {currentPage} / {totalPages}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-10"
            >
              <span className="mr-1 hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
