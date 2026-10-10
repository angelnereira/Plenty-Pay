"use client";

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'

export default function NotFound() {
  const pathname = usePathname();

  useEffect(() => {
    // Reportar el 404 a Sentry como Advertencia Proactiva
    Sentry.withScope((scope) => {
      scope.setTag("module", "404_tracker");
      scope.setLevel("warning");
      Sentry.captureMessage(`404 Página Inexistente: ${pathname || "desconocido"}`);
    });
  }, [pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          404
        </h1>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Página no encontrada
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          La página que buscas no existe o fue eliminada. Nuestro equipo ha sido notificado.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
