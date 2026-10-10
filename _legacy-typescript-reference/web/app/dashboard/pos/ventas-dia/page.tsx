import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Package,
  FileText,
  Clock,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ventas del Día | PlentyPay",
  description: "Resumen de ventas del día en el Punto de Venta",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface TopProduct {
  name: string;
  code: string;
  quantity: number;
  revenue: number;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function VentasDiaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { client: true },
  });

  if (!user?.clientId) redirect("/");

  if (!user.client?.posEnabled && session.user?.role !== "SUPER_ADMIN") {
    redirect("/dashboard/pos");
  }

  const { start, end } = getTodayRange();

  // ── Fetch today's POS invoices (INTERNAL + EMITTED + QUEUED from POS)
  const todayInvoices = await prisma.invoice.findMany({
    where: {
      clientId: user.clientId,
      createdAt: { gte: start, lte: end },
      status: { in: ["INTERNAL", "EMITTED", "QUEUED"] },
      internalNotes: { contains: "POS" },
    },
    include: {
      items: {
        select: {
          description: true,
          code: true,
          quantity: true,
          total: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── KPIs
  const totalSales = todayInvoices.length;
  const totalRevenue = todayInvoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
  const totalTax    = todayInvoices.reduce((sum, inv) => sum + Number(inv.itbms ?? 0), 0);
  const totalNet    = totalRevenue - totalTax;

  // ── Payment breakdown from internalNotes JSON
  let cashTotal = 0;
  let cardTotal = 0;
  let transferTotal = 0;

  for (const inv of todayInvoices) {
    try {
      const notes = JSON.parse(inv.internalNotes ?? "{}");
      const method  = notes.payment?.method as string | undefined;
      const details = notes.payment?.details;
      const invTotal = Number(inv.total ?? 0);

      if (method === "CASH")     cashTotal += invTotal;
      else if (method === "CARD")    cardTotal += invTotal;
      else if (method === "TRANSFER") transferTotal += invTotal;
      else if (method === "MIXED" && details) {
        cashTotal     += Number(details.cash ?? 0);
        cardTotal     += Number(details.card ?? 0);
        transferTotal += Number(details.transfer ?? 0);
      }
    } catch {
      // ignore malformed notes
    }
  }

  // ── Top products
  const productMap = new Map<string, TopProduct>();
  for (const inv of todayInvoices) {
    for (const item of inv.items) {
      const key = item.code ?? item.description;
      const existing = productMap.get(key);
      const qty = Number(item.quantity ?? 0);
      const rev = Number(item.total ?? 0);
      if (existing) {
        existing.quantity += qty;
        existing.revenue  += rev;
      } else {
        productMap.set(key, {
          name: item.description,
          code: item.code ?? "-",
          quantity: qty,
          revenue: rev,
        });
      }
    }
  }

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  // ── Recent transactions (last 8)
  const recentTx = todayInvoices.slice(0, 8);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/pos"
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Ventas del Día
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {new Intl.DateTimeFormat("es-PA", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date())}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">En vivo</span>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Ventas */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Ventas</span>
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <ShoppingBag className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalSales}
            </p>
            <p className="text-xs text-slate-400">transacciones hoy</p>
          </div>

          {/* Revenue */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ingresos</span>
              <div className="p-2 rounded-xl bg-violet-500/10">
                <DollarSign className="h-4 w-4 text-violet-500" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-slate-400">incl. ITBMS {formatCurrency(totalTax)}</p>
          </div>

          {/* Neto */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Neto</span>
              <div className="p-2 rounded-xl bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(totalNet)}
            </p>
            <p className="text-xs text-slate-400">antes de impuestos</p>
          </div>

          {/* Ticket Promedio */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ticket Prom.</span>
              <div className="p-2 rounded-xl bg-amber-500/10">
                <FileText className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(avgTicket)}
            </p>
            <p className="text-xs text-slate-400">por transacción</p>
          </div>
        </div>

        {/* ── Middle row: Payment Breakdown + Top Products ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Payment Breakdown */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-5">
              Métodos de Pago
            </h2>
            <div className="space-y-4">
              {[
                { label: "Efectivo", value: cashTotal, icon: Banknote, color: "emerald" },
                { label: "Tarjeta", value: cardTotal, icon: CreditCard, color: "violet" },
                { label: "Transferencia", value: transferTotal, icon: ArrowLeftRight, color: "blue" },
              ].map(({ label, value, icon: Icon, color }) => {
                const pct = totalRevenue > 0 ? (value / totalRevenue) * 100 : 0;
                const colorMap: Record<string, string> = {
                  emerald: "bg-emerald-500",
                  violet: "bg-violet-500",
                  blue: "bg-blue-500",
                };
                const textMap: Record<string, string> = {
                  emerald: "text-emerald-500",
                  violet: "text-violet-500",
                  blue: "text-blue-500",
                };
                const bgMap: Record<string, string> = {
                  emerald: "bg-emerald-500/10",
                  violet: "bg-violet-500/10",
                  blue: "bg-blue-500/10",
                };
                return (
                  <div key={label} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${bgMap[color]}`}>
                        <Icon className={`h-3.5 w-3.5 ${textMap[color]}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{label}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(value)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colorMap[color]} transition-all duration-700`}
                        style={{ width: `${Math.max(pct, 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Products */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-5">
              Productos Más Vendidos
            </h2>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">Sin ventas registradas hoy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((product, idx) => (
                  <div key={product.code} className="flex items-center gap-3 group">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                      <span className="text-[10px] font-black text-slate-400">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{product.name}</p>
                      <p className="text-xs text-slate-400">{product.quantity} unidades vendidas</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                      {formatCurrency(product.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Transactions ── */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-white/[0.04]">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Transacciones Recientes
            </h2>
            <span className="ml-auto text-xs text-slate-400">{totalSales} hoy</span>
          </div>

          {recentTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingBag className="h-10 w-10 text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-400">Sin ventas registradas hoy</p>
              <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Las ventas del POS aparecerán aquí</p>
              <Link
                href="/dashboard/pos"
                className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition-colors"
              >
                Ir al Punto de Venta →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-white/[0.03]">
              {recentTx.map((inv) => {
                let paymentMethod = "—";
                try {
                  const notes = JSON.parse(inv.internalNotes ?? "{}");
                  const m = notes.payment?.method as string;
                  if (m === "CASH") paymentMethod = "Efectivo";
                  else if (m === "CARD") paymentMethod = "Tarjeta";
                  else if (m === "TRANSFER") paymentMethod = "Transferencia";
                  else if (m === "MIXED") paymentMethod = "Mixto";
                } catch { /* ignore */ }

                const statusLabel: Record<string, string> = {
                  INTERNAL: "Interna",
                  EMITTED: "Emitida",
                  QUEUED: "Procesando",
                };
                const statusColor: Record<string, string> = {
                  INTERNAL: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
                  EMITTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                  QUEUED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                };

                return (
                  <Link
                    key={inv.id}
                    href={`/dashboard/facturas/${inv.id}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex-shrink-0">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-emerald-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {inv.invoiceNumber ?? "Borrador"}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {inv.receiverName ?? "Consumidor Final"} · {paymentMethod}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[inv.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabel[inv.status] ?? inv.status}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(Number(inv.total ?? 0))}
                      </span>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {formatTime(inv.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {totalSales > 8 && (
            <div className="px-6 py-3 border-t border-slate-100 dark:border-white/[0.04] text-center">
              <Link
                href="/dashboard/facturas"
                className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors"
              >
                Ver todas las facturas →
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
