"use client";

import { useState } from "react";
import { formatPanama } from "@/lib/date-utils";
import {
  Truck, Search, Eye, Calendar, MapPin, Clock,
  Package, CheckCircle2, Plus, FileText, Download
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { CreateDeliveryOrderModal } from "./orders/CreateDeliveryOrderModal";
import { CreateFromInvoiceModal } from "./orders/CreateFromInvoiceModal";
import type { DeliveryOrderStatus, OriginModeType } from "../model/types";

interface Order {
  id: string;
  code: string;
  status: DeliveryOrderStatus;
  originMode: OriginModeType;
  customerName: string;
  deliveryAddress: { text: string } | null;
  carrier: { id: string; name: string } | null;
  driver: { id: string; firstName: string; lastName: string } | null;
  totalAmount: string | null;
  createdAt: Date | string;
}

interface Props {
  initialOrders: Order[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  IN_PICKING: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  READY_TO_SHIP: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  IN_TRANSIT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  IN_PICKING: "Preparación",
  READY_TO_SHIP: "Listo / Asignado",
  IN_TRANSIT: "En Tránsito",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

function OriginBadge({ origin }: { origin: OriginModeType }) {
  if (origin === "FROM_INVOICE")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-medium border border-indigo-200">
        <CheckCircle2 className="w-3 h-3" /> Facturación
      </span>
    );
  if (origin === "FROM_POS")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-medium border border-amber-200">
        <CheckCircle2 className="w-3 h-3" /> POS
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-medium border border-slate-200">
      Manual
    </span>
  );
}

export function DeliveryOrdersClientList({ initialOrders }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFromInvoiceModalOpen, setIsFromInvoiceModalOpen] = useState(false);

  const filtered = orders.filter((o) => {
    const q = searchTerm.toLowerCase();
    return (
      o.code.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.driver?.firstName?.toLowerCase().includes(q) ?? false) ||
      (o.carrier?.name?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/50">
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por código, cliente o transporte..."
            className="pl-9 pr-4 py-2 w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFromInvoiceModalOpen(true)}
            className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Desde Factura</span>
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva OE</span>
            <span className="sm:hidden"><Plus className="h-4 w-4" /></span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
            <Truck className="h-10 w-10 text-gray-300 mb-2 opacity-50" />
            <p>No se encontraron órdenes de entrega.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código / Ref</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Destinatario</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Asignación</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-800">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{order.code}</span>
                      <OriginBadge origin={order.originMode} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 opacity-50" />
                      {formatPanama(order.createdAt, "dd/MM/yyyy")}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                      <Clock className="h-3.5 w-3.5 opacity-50" />
                      {formatPanama(order.createdAt, "h:mm a")}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{order.customerName}</div>
                    {order.deliveryAddress && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{order.deliveryAddress.text}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.carrier || order.driver ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {order.carrier?.name ?? "Transporte Propio"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {order.driver
                            ? `${order.driver.firstName} ${order.driver.lastName}`
                            : "Sin chofer"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No asignado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-full border shadow-sm",
                      STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"
                    )}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {order.totalAmount != null ? (
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${Number(order.totalAmount).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex justify-end items-center gap-1.5">
                      <Link
                        href={`/dashboard/logistics/${order.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800"
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <a
                        href={`/api/logistics/orders/${order.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-900/30 rounded-lg transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-800"
                        title="Descargar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateDeliveryOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newOrder: { id: string; code: string }) => {
          setIsCreateModalOpen(false);
          const optimistic: Order = {
            ...newOrder,
            customerName: "Cargando detalles...",
            createdAt: new Date(),
            status: "PENDING",
            originMode: "DIRECT",
            deliveryAddress: null,
            carrier: null,
            driver: null,
            totalAmount: null,
          };
          setOrders([optimistic, ...orders]);
          toast.success(`Orden ${newOrder.code} creada exitosamente.`);
        }}
      />

      <CreateFromInvoiceModal
        isOpen={isFromInvoiceModalOpen}
        onClose={() => setIsFromInvoiceModalOpen(false)}
        onSuccess={(newOrder: { id: string; code: string }) => {
          setIsFromInvoiceModalOpen(false);
          const optimistic: Order = {
            ...newOrder,
            customerName: "Desde factura...",
            createdAt: new Date(),
            status: "PENDING",
            originMode: "FROM_INVOICE",
            deliveryAddress: null,
            carrier: null,
            driver: null,
            totalAmount: null,
          };
          setOrders([optimistic, ...orders]);
          toast.success(`Orden ${newOrder.code} creada a partir de factura.`);
        }}
      />
    </div>
  );
}
