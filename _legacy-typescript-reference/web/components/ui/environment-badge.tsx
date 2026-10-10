'use client';

import React, { useEffect, useState } from 'react';

export function EnvironmentBadge() {
    const [env, setEnv] = useState<string | null>(null);

    useEffect(() => {
        // Determinar el entorno basado en el hostname o variables expuestas
        // En el cliente no tenemos process.env.NODE_ENV fiable de la misma manera que en servidor para "staging" vs "prod"
        // si usamos el mismo build, así que comprobamos el host.

        const hostname = window.location.hostname;

        if (hostname.includes('localhost')) {
            setEnv('DEV');
        } else if (hostname.includes('staging') || hostname.includes('vercel.app')) {
            setEnv('STAGING');
        } else if (hostname === 'plentypay.com' || hostname === 'www.plentypay.com') {
            // En producción no mostramos nada
            setEnv(null);
        } else {
            // Fallback para otros previews
            setEnv('PREVIEW');
        }
    }, []);

    if (!env) return null;

    // Colores por entorno
    const colors = {
        DEV: 'bg-blue-500',
        STAGING: 'bg-orange-500',
        PREVIEW: 'bg-yellow-500',
    };

    const colorClass = colors[env as keyof typeof colors] || 'bg-gray-500';

    return (
        <div className={`fixed bottom-4 right-4 z-[9999] pointer-events-none opacity-75 hover:opacity-100 transition-opacity`}>
            <div className={`${colorClass} text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-white/20`}>
                {env}
            </div>
        </div>
    );
}
