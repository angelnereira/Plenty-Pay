'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Progress } from '@shared/ui/progress';
import { Badge } from '@shared/ui/badge';
import type { FoliosRestantesResponse } from '@/features/hka/model/types/types';

interface FoliosVisualizerProps {
    data: FoliosRestantesResponse;
    loading?: boolean;
}

export function FoliosVisualizer({ data, loading = false }: FoliosVisualizerProps) {
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Consultando folios...</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-32 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Calculate percentage
    const totalCiclo = typeof data.foliosTotalesCiclo === 'string' ? parseInt(data.foliosTotalesCiclo) : data.foliosTotalesCiclo;
    const disponibles = data.foliosDisponiblesCiclo || 0;
    const utilizados = typeof data.foliosUtilizadosCiclo === 'string' ? parseInt(data.foliosUtilizadosCiclo) : data.foliosUtilizadosCiclo;
    const porcentajeDisponible = Math.round((disponibles / (totalCiclo || 1)) * 100);
    const porcentajeUtilizado = Math.round((utilizados / (totalCiclo || 1)) * 100);

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">📊 Folios Restantes - HKA</CardTitle>
                            <CardDescription>The Factory HKA - Sistema de Facturación Electrónica</CardDescription>
                        </div>
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                            ✓ Conectado
                        </Badge>
                    </div>
                </CardHeader>
            </Card>

            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                {/* Folios Disponibles */}
                <Card className="border-t-4 border-t-orange-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-semibold uppercase">
                            Folios Disponibles
                        </CardDescription>
                        <CardTitle className="text-4xl font-bold text-orange-600">
                            {disponibles.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Progress value={porcentajeDisponible} className="h-3" />
                        <p className="text-sm text-muted-foreground mt-2">
                            {porcentajeDisponible}% disponible del total
                        </p>
                    </CardContent>
                </Card>

                {/* Folios Utilizados */}
                <Card className="border-t-4 border-t-amber-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-semibold uppercase">
                            Folios Utilizados
                        </CardDescription>
                        <CardTitle className="text-4xl font-bold text-amber-600">
                            {utilizados.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Progress value={porcentajeUtilizado} className="h-3 bg-amber-200" />
                        <p className="text-sm text-muted-foreground mt-2">
                            {porcentajeUtilizado}% utilizado
                        </p>
                    </CardContent>
                </Card>

                {/* Total del Ciclo */}
                <Card className="border-t-4 border-t-purple-500">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs font-semibold uppercase">
                            Total del Ciclo
                        </CardDescription>
                        <CardTitle className="text-4xl font-bold text-purple-600">
                            {totalCiclo.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Ciclo {data.ciclo}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Details Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detalles de Licencia</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Campo</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                <tr className="hover:bg-muted/50">
                                    <td className="py-3 px-4 font-medium">Licencia</td>
                                    <td className="py-3 px-4 font-mono text-sm">{data.licencia}</td>
                                </tr>
                                <tr className="hover:bg-muted/50">
                                    <td className="py-3 px-4 font-medium">Fecha de Licencia</td>
                                    <td className="py-3 px-4">{data.fechaLicencia}</td>
                                </tr>
                                <tr className="hover:bg-muted/50">
                                    <td className="py-3 px-4 font-medium">Ciclo Actual</td>
                                    <td className="py-3 px-4">{data.ciclo}</td>
                                </tr>
                                <tr className="hover:bg-muted/50">
                                    <td className="py-3 px-4 font-medium">Fecha del Ciclo</td>
                                    <td className="py-3 px-4">{data.fechaCiclo}</td>
                                </tr>
                                <tr className="hover:bg-muted/50">
                                    <td className="py-3 px-4 font-medium">Folios Totales de Licencia</td>
                                    <td className="py-3 px-4 font-semibold">{(typeof data.foliosTotales === 'string' ? parseInt(data.foliosTotales) : data.foliosTotales).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
