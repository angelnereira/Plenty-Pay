'use client';

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  ArrowUpDown, 
  DollarSign, 
  Hash, 
  User, 
  Clock, 
  AlertCircle, 
  BarChart,
  Layers,
  LucideIcon,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SortType = 
  | 'date_desc' 
  | 'date_asc' 
  | 'number_desc' 
  | 'number_asc' 
  | 'amount_desc' 
  | 'amount_asc' 
  | 'client_asc' 
  | 'client_desc'
  | 'items_desc'
  | 'status_group'
  | 'dueDate_asc';

interface SortOption {
  id: SortType;
  label: string;
  icon: LucideIcon;
}

const SORT_OPTIONS: SortOption[] = [
  { id: 'date_desc', label: 'Fecha: Más recientes', icon: Calendar },
  { id: 'date_asc', label: 'Fecha: Más antiguas', icon: Clock },
  { id: 'dueDate_asc', label: 'Próximas a vencer', icon: Clock },
  { id: 'number_desc', label: 'Número: Descendente', icon: Hash },
  { id: 'number_asc', label: 'Número: Ascendente', icon: Hash },
  { id: 'amount_desc', label: 'Monto: Mayor a menor', icon: DollarSign },
  { id: 'amount_asc', label: 'Monto: Menor a mayor', icon: BarChart },
  { id: 'client_asc', label: 'Cliente: A-Z', icon: User },
  { id: 'client_desc', label: 'Cliente: Z-A', icon: User },
  { id: 'items_desc', label: 'Por tamaño (ítems)', icon: Layers },
  { id: 'status_group', label: 'Priorizar por Estado', icon: AlertCircle },
];

interface InvoiceSortProps {
  currentSort: SortType;
  onSortChange: (sort: SortType) => void;
}

export function InvoiceSort({ currentSort, onSortChange }: InvoiceSortProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Find active option with safety fallback
  const activeOption = SORT_OPTIONS.find(opt => opt.id === currentSort) || SORT_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Ordenar: ${activeOption.label}`}
        className={cn(
          "flex items-center gap-2 rounded-xl transition-all duration-300",
          "p-2.5 md:px-4 md:py-2.5",
          "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800",
          "hover:border-purple-400 dark:hover:border-purple-500/50 hover:shadow-lg shadow-purple-500/5",
          "text-sm font-medium text-slate-700 dark:text-slate-300",
          isOpen && "ring-2 ring-purple-500/20 border-purple-500"
        )}
      >
        <ActiveIcon size={16} className="text-purple-500" />
        <span className="hidden md:inline max-w-[150px] truncate">{activeOption.label}</span>
        <ArrowUpDown size={14} className={cn("opacity-50 transition-transform hidden md:inline-block md:ml-1", isOpen && "md:rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                "absolute right-0 mt-2 w-72 z-50 p-2 overflow-hidden",
                "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
                "border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl"
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                Criterios de Ordenamiento
              </div>
              
              <div className="space-y-0.5 max-h-[400px] overflow-y-auto scrollbar-hide py-1">
                {SORT_OPTIONS.map((option) => {
                  const OptionIcon = option.icon;
                  const isActive = currentSort === option.id;

                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        onSortChange(option.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all",
                        "text-sm text-left font-medium",
                        isActive 
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <OptionIcon 
                          size={16} 
                          className={cn(isActive ? "text-white" : "text-slate-400")} 
                        />
                        {option.label}
                      </div>
                      {isActive && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <Check size={14} className="text-white" />
                        </motion.div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
