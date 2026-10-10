"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Store, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function PosError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[POS_ERROR_BOUNDARY]", {
            message: error.message,
            digest: error.digest,
            stack: error.stack
        });
        Sentry.captureException(error, {
            tags: { module: "pos" },
        });
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-3xl mb-8 border border-green-100 dark:border-green-800/50">
                <Store className="h-16 w-16 text-green-600 dark:text-green-500" />
            </div>

            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">
                Error en Punto de Venta
            </h2>

            <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-10 text-sm leading-relaxed">
                Ha ocurrido un problema al cargar el POS. Intente reiniciar o use la facturación manual mientras tanto.
                {error.digest && (
                    <span className="block mt-4 font-mono text-[10px] bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-gray-400">
                        Error ID: {error.digest}
                    </span>
                )}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={() => reset()}
                    className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3.5 rounded-2xl font-black hover:opacity-90 transition-all shadow-xl uppercase text-xs tracking-widest active:scale-95"
                >
                    <RefreshCcw size={16} />
                    Intentar de Nuevo
                </button>

                <Link
                    href="/dashboard"
                    className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 px-8 py-3.5 rounded-2xl font-black hover:bg-gray-50 dark:hover:bg-slate-800 transition-all uppercase text-xs tracking-widest"
                >
                    <Home size={16} />
                    Ir al Dashboard
                </Link>
            </div>
        </div>
    );
}
