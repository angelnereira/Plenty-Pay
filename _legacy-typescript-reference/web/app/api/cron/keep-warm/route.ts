import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { withSentryCron } from '@/lib/sentry/cron-wrapper';

const handler = async () => {
    try {
        // Ejecutar query liviano a DB para mantener el connection pool vivo (Neon)
        // y evitar sleep de las function de Vercel (Cold Start)
        await prisma.$queryRaw`SELECT 1`;

        return NextResponse.json({ success: true, timestamp: Date.now() });
    } catch (error) {
        console.error('Error en keep-warm cron:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
};

export const GET = withSentryCron(
    'keep-warm',
    { schedule: '*/5 * * * *', maxRuntimeSeconds: 30 },
    handler as unknown as (request: NextRequest) => Promise<NextResponse>,
);
