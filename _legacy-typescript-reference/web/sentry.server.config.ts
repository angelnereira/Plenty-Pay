import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // ── Environment & Release ──────────────────────────────────
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,

  // ── PII & Sampling ─────────────────────────────────────────
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // ── Server-specific ────────────────────────────────────────
  includeLocalVariables: true,
  enableLogs: true,

  // ── Noise Filtering ────────────────────────────────────────
  ignoreErrors: [
    // Network / timeout errors that are not actionable
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "socket hang up",
    "fetch failed",
    // Prisma connection issues (transient in serverless)
    "Can't reach database server",
    "Connection pool timeout",
    "Server has closed the connection",
    // Next.js internal
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  // ── Context Enrichment ─────────────────────────────────────
  beforeSend(event: Sentry.ErrorEvent) {
    // Tag with the Vercel deployment URL if available
    if (process.env.VERCEL_URL) {
      event.tags = { ...event.tags, vercel_url: process.env.VERCEL_URL };
    }
    return event;
  },
});
