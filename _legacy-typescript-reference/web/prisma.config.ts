import { defineConfig } from '@prisma/config';

// La opción `datasource` no es parte del tipo público de PrismaConfig en esta
// versión de @prisma/config; se mantiene en runtime por compatibilidad pero
// se castea para evitar el error de tipos. La URL viene de DATABASE_URL en
// runtime y el `!` se justifica porque sin ella Prisma falla antes de cargar
// este archivo (verificado por scripts/verify-env.js durante el build).
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
} as Parameters<typeof defineConfig>[0]);
