/**
 * core/dataport/schedule.ts — utilidades de programación (UTC).
 */

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Próxima ejecución (UTC) estrictamente posterior a `from`. */
export function computeNextRun(
    frequency: Frequency,
    atHour: number,
    opts: { dayOfWeek?: number | null; dayOfMonth?: number | null },
    from: Date = new Date(),
): Date {
    const next = new Date(from);
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(atHour);

    if (frequency === 'DAILY') {
        if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
        return next;
    }
    if (frequency === 'WEEKLY') {
        const target = opts.dayOfWeek ?? 1;
        let delta = (target - next.getUTCDay() + 7) % 7;
        if (delta === 0 && next <= from) delta = 7;
        next.setUTCDate(next.getUTCDate() + delta);
        return next;
    }
    // MONTHLY
    const dom = Math.min(opts.dayOfMonth ?? 1, 28);
    next.setUTCDate(dom);
    if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1, dom);
    return next;
}

const ISO = (d: Date) => d.toISOString().slice(0, 10);

/** Resuelve la ventana de período para una corrida programada. */
export function resolveWindow(periodWindow: string, now: Date = new Date()): { from?: string; to?: string } {
    const to = ISO(now);
    switch (periodWindow) {
        case 'ROLLING_7D': {
            const f = new Date(now); f.setUTCDate(f.getUTCDate() - 6); return { from: ISO(f), to };
        }
        case 'MTD': {
            const f = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); return { from: ISO(f), to };
        }
        case 'YTD': {
            const f = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); return { from: ISO(f), to };
        }
        case 'ALL':
            return {};
        case 'ROLLING_30D':
        default: {
            const f = new Date(now); f.setUTCDate(f.getUTCDate() - 29); return { from: ISO(f), to };
        }
    }
}
