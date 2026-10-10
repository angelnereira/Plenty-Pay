'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Progress } from '@shared/ui/progress';
import { Badge } from '@shared/ui/badge';
import {
  CheckCircle2,
  Circle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Send,
  CheckSquare,
  Download,
  Mail,
  Eye,
  Folder
} from 'lucide-react';

interface PhaseInfo {
  phase: number;
  name: string;
  isCritical: boolean;
  status: 'pending' | 'running' | 'completed' | 'warning' | 'failed';
  error?: string;
}

interface ProgressData {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  currentPhase: number;
  progress: number;
  isComplete: boolean;
  isCertified: boolean;
  hasError: boolean;
  phases: PhaseInfo[];
  cafe?: string;
  cufe?: string;
  hkaProtocol?: string;
  lastUpdate: string;
}

interface InvoicePhaseProgressProps {
  invoiceId: string;
  onComplete?: (isCertified: boolean) => void;
  pollingInterval?: number; // milliseconds
}

const PHASE_ICONS: Record<number, typeof FileText> = {
  0: FileText,
  1: CheckSquare,
  2: Send,
  3: CheckSquare,
  4: Download,
  5: Download,
  6: Mail,
  7: Eye,
  8: Folder,
};

const PHASE_LABELS: Record<number, string> = {
  0: 'Generación XML',
  1: 'Validación RUC',
  2: 'Envío a HKA',
  3: 'Verificación DGI',
  4: 'Descarga XML',
  5: 'Descarga PDF',
  6: 'Envío Email',
  7: 'Rastreo Email',
  8: 'Verificación Folios',
};

export function InvoicePhaseProgress({
  invoiceId,
  onComplete,
  pollingInterval = 3000,
}: InvoicePhaseProgressProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/invoices/${invoiceId}/progress`);

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data: ProgressData = await response.json();
        setProgressData(data);
        setError(null);

        // Stop polling if processing is complete
        if (data.isComplete) {
          setIsPolling(false);
          onComplete?.(data.isCertified);
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    };

    // Initial fetch
    fetchProgress();

    // Start polling if not complete
    if (isPolling) {
      intervalId = setInterval(fetchProgress, pollingInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [invoiceId, isPolling, pollingInterval, onComplete]);

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Error al cargar progreso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!progressData) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando progreso...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Progreso de Procesamiento</CardTitle>
            <CardDescription>
              Factura #{progressData.invoiceNumber || progressData.invoiceId.slice(0, 8)}
            </CardDescription>
          </div>
          <Badge
            variant={
              progressData.isCertified
                ? 'default'
                : progressData.hasError
                ? 'destructive'
                : 'secondary'
            }
          >
            {progressData.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso general</span>
            <span className="font-medium">{progressData.progress}%</span>
          </div>
          <Progress value={progressData.progress} className="h-2" />
        </div>

        {/* Phase List */}
        <div className="space-y-3">
          {progressData.phases.map((phase) => (
            <PhaseItem key={phase.phase} phase={phase} />
          ))}
        </div>

        {/* Additional Info */}
        {progressData.isCertified && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Factura Certificada
            </div>
            {progressData.cafe && (
              <div className="text-sm text-green-600">
                <span className="font-medium">CAFE:</span> {progressData.cafe}
              </div>
            )}
            {progressData.hkaProtocol && (
              <div className="text-sm text-green-600">
                <span className="font-medium">Protocolo:</span> {progressData.hkaProtocol}
              </div>
            )}
          </div>
        )}

        {progressData.hasError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-700 font-medium">
              <XCircle className="h-5 w-5" />
              Error en Procesamiento
            </div>
            <p className="text-sm text-red-600 mt-1">
              Revise los detalles de las fases para más información.
            </p>
          </div>
        )}

        {/* Last Update */}
        <div className="text-xs text-muted-foreground text-right">
          Última actualización: {new Date(progressData.lastUpdate).toLocaleString('es-PA')}
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseItem({ phase }: { phase: PhaseInfo }) {
  const Icon = PHASE_ICONS[phase.phase] || Circle;

  const getStatusIcon = () => {
    switch (phase.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (phase.status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${getStatusColor()}`}>
      <div className="mt-0.5">{getStatusIcon()}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm">
            {PHASE_LABELS[phase.phase] || phase.name}
          </span>
          {phase.isCritical && (
            <Badge variant="outline" className="text-xs">
              Crítica
            </Badge>
          )}
        </div>
        {phase.error && (
          <p className="text-xs text-red-600 mt-1 break-words">{phase.error}</p>
        )}
      </div>
    </div>
  );
}
