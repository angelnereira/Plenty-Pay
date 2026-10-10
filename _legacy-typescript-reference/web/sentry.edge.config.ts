import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // ── Environment & Release ──────────────────────────────────
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,

  // ── PII & Sampling ─────────────────────────────────────────
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,

  // ── Noise Filtering ────────────────────────────────────────
  ignoreErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "fetch failed",
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],
});
