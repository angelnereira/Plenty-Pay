"use client";

import Link from "next/link";
import { Plus, ArrowDownToLine, ChevronDown, ShoppingCart, PackagePlus } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@shared/ui/dropdown-menu";

interface InventoryHeaderActionsProps {
    onQuickAdd?: () => void;
}

export function InventoryHeaderActions({ onQuickAdd }: InventoryHeaderActionsProps) {
    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="flex flex-1 lg:flex-none items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 lg:px-6 lg:py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:opacity-90 shadow-xl shadow-slate-900/10 active:scale-95 border border-transparent">
                        <Plus size={16} className="shrink-0" />
                        <span>Ingresar</span>
                        <ChevronDown size={13} className="opacity-50 shrink-0" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 shadow-2xl">
                    <DropdownMenuItem asChild>
                        <Link
                            href="/dashboard/inventory/productos/nuevo"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <Plus size={16} className="text-emerald-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 dark:text-white">Nuevo Producto</span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-tight">Crear definición base</span>
                            </div>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link
                            href="/dashboard/inventory/lotes/ingreso"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors mt-1"
                        >
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                <ArrowDownToLine size={16} className="text-violet-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 dark:text-white">Entrada por Lote</span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-tight">Cargar stock y costos</span>
                            </div>
                        </Link>
                    </DropdownMenuItem>
                    {onQuickAdd && (
                        <DropdownMenuItem asChild>
                            <button
                                onClick={onQuickAdd}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors mt-1"
                            >
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <PackagePlus size={16} className="text-cyan-500" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 dark:text-white">Ajuste Rápido</span>
                                    <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-tight">Adicionar a existencia</span>
                                </div>
                            </button>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                        <Link
                            href="/dashboard/inventory/ordenes-compra/nueva"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors mt-1"
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <ShoppingCart size={16} className="text-blue-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 dark:text-white">Orden de Compra</span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-tight">Solicitar a proveedor</span>
                            </div>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>

            </DropdownMenu>
        </div>
    );
}

