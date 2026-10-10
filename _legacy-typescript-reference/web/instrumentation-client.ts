import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // ── Environment & Release ──────────────────────────────────
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? undefined,

  // ── PII & Sampling ─────────────────────────────────────────
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // ── Session Replay ─────────────────────────────────────────
  // 10% of all sessions, but 100% of sessions that encounter an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enableLogs: true,

  // ── Integrations ───────────────────────────────────────────
  integrations: [
    Sentry.replayIntegration({
      // Don't mask text/media so we get full context in replays
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // ── Noise Filtering (Browser) ──────────────────────────────
  ignoreErrors: [
    // Browser quirks — not actionable
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
    // Network errors from user disconnection
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    "AbortError",
    // Next.js chunk loading (usually stale deploys)
    "ChunkLoadError",
    "Loading chunk",
    // PWA / Service Worker
    "ServiceWorker",
    // User-cancelled navigation
    "cancelled",
    "The operation was aborted",
    // Browser extensions
    "Extension context invalidated",
  ],

  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    // Firefox extensions
    /^moz-extension:\/\//i,
    // Safari extensions
    /^safari-(web-)?extension:\/\//i,
    // Common third-party scripts
    /analytics/i,
    /hotjar/i,
    /gtag/i,
  ],
});

// Hook into App Router navigation transitions (App Router only)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
