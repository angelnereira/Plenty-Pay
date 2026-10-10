/**
 * scripts/ai-gateway-test.ts
 *
 * Vercel AI Gateway — test de integración.
 * Usa el SDK de Vercel AI (ai@6) con el gateway configurado.
 *
 * Ejecutar: npx tsx scripts/ai-gateway-test.ts
 */

import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const apiKey = process.env.AI_GATEWAY_API_KEY;
if (!apiKey) {
  console.error("❌  AI_GATEWAY_API_KEY no está definida en .env.local");
  process.exit(1);
}

// Configura el proveedor apuntando al Vercel AI Gateway
// compatibility: "compatible" fuerza /v1/chat/completions en lugar de /v1/responses
const openai = createOpenAI({
  apiKey,
  baseURL: "https://ai-gateway.vercel.sh/v1",
  compatibility: "compatible",
});

async function main() {
  console.log("🚀  Iniciando stream con Vercel AI Gateway...\n");

  const result = streamText({
    model: openai("openai/gpt-5.4"),
    prompt:
      "Di hola en español y menciona una curiosidad interesante sobre Panamá en 2 oraciones.",
    onFinish({ usage }) {
      console.log("\n\n📊  Token usage:");
      console.log(`   Prompt tokens    : ${usage.promptTokens}`);
      console.log(`   Completion tokens: ${usage.completionTokens}`);
      console.log(`   Total tokens     : ${usage.totalTokens}`);
    },
  });

  process.stdout.write("🤖  Respuesta: ");
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
}

main().catch((err) => {
  console.error("\n❌  Error:", err.message ?? err);
  process.exit(1);
});
