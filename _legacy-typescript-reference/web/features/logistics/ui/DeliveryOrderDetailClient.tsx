"use client";

import { useState } from "react";
import {
  Truck, Package, MapPin, Calendar, Clock, User,
  FileText, ChevronRight, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, QrCode, ExternalLink, Download,
  ChevronDown
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { formatPanama } from "@/lib/date-utils";
import type { DeliveryOrderDetail, DeliveryOrderStatus } from "../model/types";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  IN_PICKING: "bg-indigo-100 text-indigo-700 border-indigo-200",
  READY_TO_SHIP: "bg-blue-100 text-blue-700 border-blue-200",
  IN_TRANSIT: "bg-purple-100 text-purple-700 border-purple-200",
  DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
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

const NEXT_STATUSES: Record<DeliveryOrderStatus, DeliveryOrderStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["IN_PICKING", "CANCELLED"],
  IN_PICKING: ["READY_TO_SHIP", "CANCELLED"],
  READY_TO_SHIP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

interface Props {
  order: DeliveryOrderDetail;
}

const PDF_TEMPLATES = [
  { key: "logistics", label: "Logístico", desc: "Formal con firmas y QR" },
  { key: "commercial", label: "Comercial", desc: "Zona Libre / detallado" },
  { key: "simple", label: "Proforma", desc: "Simple y minimalista" },
] as const;

export function DeliveryOrderDetailClient({ order: initialOrder }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  async function handleDownloadPdf(templateKey: string) {
    setGeneratingPdf(true);
    setPdfMenuOpen(false);
    try {
      const res = await fetch(`/api/logistics/orders/${order.id}/pdf?template=${templateKey}`);
      if (!res.ok) throw new Error("Error al generar PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OE-${order.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF descargado");
    } catch {
      toast.error("Error al generar el PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleStatusChange(newStatus: DeliveryOrderStatus) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/logistics/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Error al actualizar el estado");
      setOrder((prev) => ({ ...prev, status: newStatus }));
      toast.success(`Estado actualizado a "${STATUS_LABELS[newStatus]}"`);
    } catch {
      toast.error("No se pudo actualizar el estado");
    } finally {
      setUpdatingStatus(false);
    }
  }

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];
  const hasPricing = order.totalAmount != null;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{order.code}</h1>
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border",
                STATUS_STYLES[order.status]
              )}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Creada {formatPanama(order.createdAt, "dd/MM/yyyy 'a las' h:mm a")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* PDF Template Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setPdfMenuOpen(!pdfMenuOpen)}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
              <ChevronDown className="h-3 w-3" />
            </Button>
            {pdfMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPdfMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Elegir modelo de documento</p>
                  </div>
                  {PDF_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleDownloadPdf(t.key)}
                      className="w-full text-left px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{t.label}</div>
                      <div className="text-xs text-gray-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {nextStatuses.map((s) => (
            <Button
              key={s}
              size="sm"
              disabled={updatingStatus}
              onClick={() => handleStatusChange(s)}
              className={cn(
                "gap-2",
                s === "CANCELLED"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : s === "DELIVERED"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {updatingStatus ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ítems</h2>
              <span className="text-xs text-gray-400">({order.items.length})</span>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cant.</th>
                    {hasPricing && (
                      <>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">P/Unit</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ITBMS</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3 text-sm text-gray-900 dark:text-white">{item.description}</td>
                      <td className="px-5 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{Number(item.quantity)}</td>
                      {hasPricing && (
                        <>
                          <td className="px-5 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                            {item.unitPrice != null ? `$${Number(item.unitPrice).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                            {item.taxRate != null ? `${(Number(item.taxRate) * 100).toFixed(0)}%` : "—"}
                          </td>
                          <td className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {item.lineTotal != null ? `$${Number(item.lineTotal).toFixed(2)}` : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            {hasPricing && (
              <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 flex flex-col items-end gap-1.5">
                {order.subtotal != null && (
                  <div className="flex gap-12 text-sm text-gray-600 dark:text-gray-400">
                    <span>Total Neto</span>
                    <span>${Number(order.subtotal).toFixed(2)}</span>
                  </div>
                )}
                {order.taxAmount != null && Number(order.taxAmount) > 0 && (
                  <div className="flex gap-12 text-sm text-gray-600 dark:text-gray-400">
                    <span>ITBMS</span>
                    <span>${Number(order.taxAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex gap-12 text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-2 mt-1">
                  <span>TOTAL</span>
                  <span>${Number(order.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Status History */}
          {order.statusHistory.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Historial de Estado</h2>
              </div>
              <div className="p-5 space-y-3">
                {order.statusHistory.map((h) => (
                  <div key={h.id} className="flex items-start gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <ChevronRight className="h-3 w-3 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {h.fromStatus ? (
                          <span>
                            <span className="font-medium">{STATUS_LABELS[h.fromStatus]}</span>
                            {" → "}
                            <span className="font-medium">{STATUS_LABELS[h.toStatus]}</span>
                          </span>
                        ) : (
                          <span className="font-medium">{STATUS_LABELS[h.toStatus]}</span>
                        )}
                      </div>
                      {h.notes && <p className="text-xs text-gray-500 mt-0.5">{h.notes}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatPanama(h.createdAt, "dd/MM/yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-4">
          {/* Recipient */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Destinatario</h2>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{order.customerName}</p>
              {order.customerPhone && (
                <p className="text-sm text-gray-500">{order.customerPhone}</p>
              )}
              {order.customerEmail && (
                <p className="text-sm text-gray-500">{order.customerEmail}</p>
              )}
              {order.deliveryAddress && (
                <div className="flex items-start gap-1.5 text-sm text-gray-500 pt-1">
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{order.deliveryAddress.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Transporte</h2>
            </div>
            {order.carrier || order.driver ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {order.carrier?.name ?? "Transporte propio"}
                </p>
                {order.driver && (
                  <p className="text-sm text-gray-500">
                    {order.driver.firstName} {order.driver.lastName}
                    {order.driver.phone && ` · ${order.driver.phone}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin asignar</p>
            )}
          </div>

          {/* Dates */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Fechas</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Creación</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatPanama(order.createdAt, "dd/MM/yyyy")}
                </span>
              </div>
              {order.scheduledDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Programada</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formatPanama(order.scheduledDate, "dd/MM/yyyy")}
                  </span>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Entregada</span>
                  <span className="text-emerald-600 font-medium">
                    {formatPanama(order.deliveredAt, "dd/MM/yyyy")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* QR Tracking */}
          {order.qrToken && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">QR de Rastreo</h2>
              </div>
              <div className="flex flex-col items-center space-y-3">
                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/track/${order.qrToken}`}
                    size={140}
                    level="M"
                  />
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  Escanea para ver el estado de la entrega en tiempo real
                </p>
                <div className="flex gap-2 w-full">
                  <a
                    href={`/track/${order.qrToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                      <ExternalLink className="h-3 w-3" /> Ver tracking
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      const url = `${window.location.origin}/track/${order.qrToken}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Enlace de rastreo copiado");
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Notas</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
