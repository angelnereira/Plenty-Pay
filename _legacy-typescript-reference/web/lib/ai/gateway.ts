/**
 * lib/ai/gateway.ts
 *
 * Singleton del proveedor Vercel AI Gateway para PlentyPay.
 * Todas las rutas AI deben importar desde aquí — nunca crear
 * su propio `createOpenAI` para evitar duplicar config.
 *
 * Variables de entorno requeridas:
 *   AI_GATEWAY_API_KEY — obtenida de Vercel Dashboard → AI Gateway → API Keys
 */

import { createOpenAI } from "@ai-sdk/openai";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Proveedor principal
// ---------------------------------------------------------------------------

export const aiGateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY!,
  baseURL: "https://ai-gateway.vercel.sh/v1",
});

// ---------------------------------------------------------------------------
// Modelos por caso de uso (balancear costo vs calidad)
// ---------------------------------------------------------------------------

export const AI_MODELS = {
  /** Soporte: necesita razonamiento contextual y comprensión larga */
  support: "openai/gpt-4o-mini",
  /** Autocompletado de facturas: rapidez > perfección */
  suggest: "openai/gpt-4o-mini",
  /** Validación pre-HKA: barato, muchas llamadas por sesión */
  validate: "openai/gpt-4o-mini",
} as const;

// ---------------------------------------------------------------------------
// Rate limiting por tenant (usando Upstash ya configurado en el proyecto)
// 30 requests AI por día por company. Ajustar según plan.
// ---------------------------------------------------------------------------

export const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 d"),
  prefix: "plentypay:ai",
  analytics: false,
});
