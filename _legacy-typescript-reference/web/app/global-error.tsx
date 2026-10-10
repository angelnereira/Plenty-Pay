'use client';

import * as Sentry from '@sentry/nextjs';
import Error from 'next/error';
import { useEffect } from 'react';

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        // Log error to console in development
        console.error('[GlobalError]', error);
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <Error statusCode={500} />
            </body>
        </html>
    );
}
