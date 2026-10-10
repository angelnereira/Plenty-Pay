/**
 * Sentry Cron Monitoring Wrapper
 *
 * Wraps Vercel cron job handlers with Sentry.withMonitor() to automatically
 * report check-ins (in_progress -> ok/error) to the Sentry Crons dashboard.
 */

import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';

interface CronOptions {
  /** Crontab schedule expression (must match vercel.json) */
  schedule: string;
  /** Maximum expected runtime in seconds (default: 120) */
  maxRuntimeSeconds?: number;
  /** Checkin margin in minutes (default: 2) */
  checkinMarginMinutes?: number;
}

type CronHandler = (request: NextRequest) => Promise<NextResponse>;

export function withSentryCron(
  monitorSlug: string,
  options: CronOptions,
  handler: CronHandler,
): CronHandler {
  return async (request: NextRequest) => {
    return Sentry.withMonitor(
      monitorSlug,
      async () => {
        return handler(request);
      },
      {
        schedule: {
          type: 'crontab',
          value: options.schedule,
        },
        maxRuntime: options.maxRuntimeSeconds ?? 120,
        checkinMargin: options.checkinMarginMinutes ?? 2,
      },
    );
  };
}
