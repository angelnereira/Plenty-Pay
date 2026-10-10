'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import type { ConsultarRucDVResponse, HKAResponse } from '@/features/hka/model/types/types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface RucVisualizerProps {
    data: HKAResponse<ConsultarRucDVResponse>;
    loading?: boolean;
}

export function RucVisualizer({ data, loading = false }: RucVisualizerProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Consultando RUC...</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-32 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const isAfiliado = data.data?.afiliadoFE?.includes('Afiliado');

    return (
        <Card className="border-l-4 border-l-green-500">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-2xl">🔍 Información de RUC - DGI</CardTitle>
                        <CardDescription>Validación con Dirección General de Ingresos</CardDescription>
                    </div>
                    <Badge variant={data.code === '200' ? 'default' : 'destructive'} className="bg-green-500">
                        {data.code === '200' ? '✓' : '✗'} Código {data.code}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
                {/* Main Info */}
                <div className="grid gap-4 md:grid-cols-2">
                    {/* RUC y DV */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-muted-foreground uppercase">
                            RUC Completo
                        </label>
                        <div className="text-2xl font-bold font-mono">
                            {data.data?.ruc || 'N/A'}
                            {data.data?.dv && (
                                <span className="text-green-600 ml-2">-{data.data.dv}</span>
                            )}
                        </div>
                    </div>

                    {/* Tipo */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-muted-foreground uppercase">
                            Tipo de Contribuyente
                        </label>
                        <div className="text-2xl font-semibold">
                            {data.data?.tipoRuc === '2' ? '🏢 Jurídico' : '👤 Natural'}
                        </div>
                    </div>
                </div>

                {/* Razón Social */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-muted-foreground uppercase">
                        Razón Social / Nombre
                    </label>
                    <div className="text-xl font-semibold p-4 bg-muted rounded-lg">
                        {data.data?.razonSocial || 'N/A'}
                    </div>
                </div>

                {/* Status FE */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-muted-foreground uppercase">
                        Estado Facturación Electrónica
                    </label>
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-200 dark:border-green-800">
                        {isAfiliado ? (
                            <>
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                <span className="font-semibold text-green-700 dark:text-green-400">
                                    {data.data?.afiliadoFE}
                                </span>
                            </>
                        ) : (
                            <>
                                <XCircle className="h-6 w-6 text-red-600" />
                                <span className="font-semibold text-red-700 dark:text-red-400">
                                    No afiliado a Factura Electrónica
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Message */}
                {data.message && (
                    <div className="text-sm text-muted-foreground italic border-l-2 border-muted pl-4">
                        {data.message}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
