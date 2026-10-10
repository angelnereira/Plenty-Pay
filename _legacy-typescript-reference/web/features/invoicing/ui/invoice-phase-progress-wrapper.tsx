'use client';

import { useState } from 'react';
import { InvoicePhaseProgress } from './invoice-phase-progress';
import { Button } from '@shared/ui/button';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface InvoicePhaseProgressWrapperProps {
  invoiceId: string;
  initialStatus: string;
}

/**
 * Wrapper component for invoice phase progress that handles completion
 * and provides refresh functionality
 */
export function InvoicePhaseProgressWrapper({
  invoiceId,
  initialStatus,
}: InvoicePhaseProgressWrapperProps) {
  const router = useRouter();
  const [showProgress, setShowProgress] = useState(
    initialStatus === 'PROCESSING' || initialStatus === 'QUEUED'
  );

  const handleComplete = (isCertified: boolean) => {
    console.log(`Invoice processing complete. Certified: ${isCertified}`);
    // Refresh the page to show updated invoice data
    router.refresh();
  };

  const handleRefresh = () => {
    setShowProgress(true);
    router.refresh();
  };

  // Only show progress component if invoice is being processed
  if (!showProgress && initialStatus !== 'PROCESSING' && initialStatus !== 'QUEUED') {
    return null;
  }

  return (
    <div className="space-y-4">
      <InvoicePhaseProgress
        invoiceId={invoiceId}
        onComplete={handleComplete}
        pollingInterval={3000}
      />

      {!showProgress && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Ver progreso
          </Button>
        </div>
      )}
    </div>
  );
}
