/**
 * app/api/ai/support/route.ts
 *
 * Endpoint de soporte inteligente con Vercel AI Gateway.
 *
 * — Streaming SSE vía AI SDK
 * — Contexto dinámico: últimas facturas con error del tenant (desde Prisma)
 * — Rate limiting: 30 requests/día/tenant vía Upstash (ya configurado)
 * — Seguridad: company_id SIEMPRE del token, nunca del body (REGLA 5)
 */

import { NextRequest } from "next/server";
import { streamText } from "ai";
import { auth } from "@core/auth";
import { prismaServer as prisma } from "@core/database";
import { aiGateway, AI_MODELS, aiRatelimit } from "@/lib/ai/gateway";

export const runtime = "nodejs";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Prompt base del asistente
// ---------------------------------------------------------------------------

const BASE_SYSTEM = `Eres PlentyAI, el asistente inteligente de soporte de PlentyPay.
PlentyPay es una plataforma de facturación electrónica para Panamá (DGI / HKA - The Factory).

Tu rol:
- Responder dudas sobre facturación electrónica panameña (CUFE, folios, DGI, tipos de documento).
- Explicar errores del sistema HKA y cómo resolverlos.
- Guiar al usuario en el uso de los módulos de PlentyPay (Facturación, POS, Inventario, Logística).
- Si la pregunta está fuera del alcance de PlentyPay, indicarlo amablemente.

Reglas de tono:
- Responde SIEMPRE en español.
- Sé conciso pero completo. Usa listas cuando haya múltiples pasos.
- No inventes información fiscal. Si no sabes algo con certeza, dilo.
- No menciones que eres ChatGPT, GPT o OpenAI. Eres PlentyAI.`;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticación — company_id SOLO del token (REGLA 5)
    const session = await auth();
    if (!session?.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const companyId = session.user.clientId;
    const userId = session.user.id;

    // 2. Rate limiting por tenant
    const { success, remaining } = await aiRatelimit.limit(
      `support:${companyId}`
    );
    if (!success) {
      return new Response(
        JSON.stringify({
          error: "Límite de consultas AI alcanzado. Intenta mañana.",
          remaining: 0,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 3. Leer mensajes del body
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensajes inválidos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Contexto dinámico: últimas facturas con error del tenant
    //    Filtramos siempre por companyId (REGLA 5)
    const recentErrorInvoices = await prisma.invoice.findMany({
      where: {
        clientId: companyId,
        status: { in: ["REJECTED", "ERROR"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        hkaMessage: true,
        hkaResponseCode: true,
        receiverName: true,
        total: true,
        updatedAt: true,
      },
    });

    // Contexto de folios disponibles
    const folioAssignment = await prisma.folioAssignment.findFirst({
      where: { clientId: companyId },
      orderBy: { assignedAt: "desc" },
      select: {
        assignedAmount: true,
        consumedAmount: true,
      },
    });

    const folioContext = folioAssignment
      ? `Folios disponibles: ${folioAssignment.assignedAmount - folioAssignment.consumedAmount} de ${folioAssignment.assignedAmount} asignados.`
      : "No hay información de folios disponible.";

    const errorContext =
      recentErrorInvoices.length > 0
        ? `Últimas facturas con error del tenant:\n${recentErrorInvoices
            .map(
              (inv) =>
                `- Factura ${inv.invoiceNumber ?? inv.id.slice(-6)} | Estado: ${inv.status} | Cliente: ${inv.receiverName} | Total: $${inv.total} | Error HKA: ${inv.hkaMessage ?? "N/A"} (Código: ${inv.hkaResponseCode ?? "N/A"})`
            )
            .join("\n")}`
        : "No hay facturas con error recientes para este tenant.";

    // 5. System prompt enriquecido con contexto del tenant
    const systemPrompt = `${BASE_SYSTEM}

--- CONTEXTO DEL TENANT ACTUAL ---
${errorContext}
${folioContext}
Consultas AI restantes hoy: ${remaining}
---`;

    // 6. Streaming con AI SDK → Vercel AI Gateway
    const result = streamText({
      model: aiGateway(AI_MODELS.support),
      system: systemPrompt,
      messages,
      maxOutputTokens: 800,
      temperature: 0.4,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[AI_SUPPORT_ERROR]", error);
    return new Response(
      JSON.stringify({ error: "Error interno del asistente AI" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
