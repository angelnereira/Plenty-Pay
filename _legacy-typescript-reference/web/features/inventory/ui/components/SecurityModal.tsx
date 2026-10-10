"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";

interface SecurityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
    title?: string;
    description?: string;
    actionLabel?: string;
    isLoading?: boolean;
}

export function SecurityModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirmación de Seguridad",
    description = "Se requiere su contraseña de usuario para autorizar esta operación.",
    actionLabel = "Autorizar Operación",
    isLoading = false
}: SecurityModalProps) {
    const [password, setPassword] = useState("");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password.trim()) {
            onConfirm(password);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-2xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                        <ShieldCheck size={32} />
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-left">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                placeholder="••••••••"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                type="submit"
                                disabled={isLoading || !password}
                                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 uppercase text-xs tracking-widest active:scale-95"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : actionLabel}
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="w-full py-2 text-xs font-black text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors uppercase tracking-widest"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
