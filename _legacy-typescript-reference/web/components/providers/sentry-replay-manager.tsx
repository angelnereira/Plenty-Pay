"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

export function SentryReplayManager() {
  const pathname = usePathname();
  const hasStarted = useRef(false);

  useEffect(() => {
    // Si la ruta pertenece a los módulos críticos (POS o Facturación)
    if (pathname?.startsWith("/dashboard/pos") || pathname?.startsWith("/dashboard/facturas")) {
      if (!hasStarted.current) {
        const replay = Sentry.getReplay();
        if (replay) {
          replay.start();
          hasStarted.current = true;
          // Agregamos un tag visual para saber que el Replay se forzó explícitamente y no por un error
          Sentry.setTag("replay_forced", "true");
        }
      }
    } else {
      // Si el usuario sale del flujo crítico, detenemos el Replay para ahorrar ancho de banda y cuota
      if (hasStarted.current) {
        const replay = Sentry.getReplay();
        if (replay) {
          // El método .stop() existe en la instancia interna del SDK
          replay.stop();
          hasStarted.current = false;
          Sentry.setTag("replay_forced", "false");
        }
      }
    }
  }, [pathname]);

  return null;
}
