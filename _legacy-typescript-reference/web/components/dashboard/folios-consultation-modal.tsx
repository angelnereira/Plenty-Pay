'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@shared/ui/dialog';
import { Button } from '@shared/ui/button';
import { FoliosVisualizer } from '@/features/hka/ui/folios-visualizer';
import { checkFoliosAction } from '@/actions/hka/check-folios.action';
import type { FoliosResult } from '@/features/hka/model/methods/folios';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface FoliosConsultationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FoliosConsultationModal({ isOpen, onClose }: FoliosConsultationModalProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<FoliosResult | null>(null);

    const fetchFolios = async () => {
        setLoading(true);
        try {
            const response = await checkFoliosAction();
            setResult(response);
            if (!response.success) {
                toast.error(response.error || 'Error al consultar folios');
            }
        } catch (error) {
            console.error('Error fetching folios:', error);
            toast.error('Error inesperado al consultar folios');
        } finally {
            setLoading(false);
        }
    };

    // Fetch on open
    useEffect(() => {
        if (isOpen) {
            fetchFolios();
        } else {
            // Reset state when closed
            setResult(null);
            setLoading(false);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-hide">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Consulta de Folios - HKA</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchFolios}
                            disabled={loading}
                            className="ml-4"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </Button>
                    </DialogTitle>
                    <DialogDescription>
                        Estado actual de la licencia y folios disponibles en el PAC HKA.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            <p className="text-muted-foreground">Consultando folios en tiempo real...</p>
                        </div>
                    ) : result?.success && result ? (
                        <FoliosVisualizer data={result as any} loading={false} />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
                            <p className="text-red-600 dark:text-red-400 font-medium">
                                {result?.error || 'No se pudo obtener la información de folios.'}
                            </p>
                            <Button variant="secondary" onClick={fetchFolios}>
                                Intentar de nuevo
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
