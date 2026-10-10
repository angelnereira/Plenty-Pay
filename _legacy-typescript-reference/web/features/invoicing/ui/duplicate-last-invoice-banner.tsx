'use client';
import { Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { useLastInvoice, type LastInvoiceSummary } from '@/shared/hooks/use-last-invoice';

interface DuplicateLastInvoiceBannerProps {
  clientId: string | null;
  onDuplicate: (data: LastInvoiceSummary) => void;
}

export function DuplicateLastInvoiceBanner({ clientId, onDuplicate }: DuplicateLastInvoiceBannerProps) {
  const { data, isLoading } = useLastInvoice(clientId);

  if (!clientId) return null;

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-lg" />;
  }

  if (!data) return null;

  const formattedDate = new Date(data.emittedAt).toLocaleDateString('es-PA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedAmount = new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'USD',
  }).format(data.totalAmount);

  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          Última factura:{' '}
          <span className="font-medium text-foreground">
            {data.invoiceNumber ?? 'Sin número'}
          </span>
          {' · '}
          {formattedDate}
          {' · '}
          {formattedAmount}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onDuplicate(data)}
        className="shrink-0"
      >
        Duplicar
      </Button>
    </div>
  );
}
