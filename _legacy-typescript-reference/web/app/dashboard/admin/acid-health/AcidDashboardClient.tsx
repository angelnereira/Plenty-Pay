"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import {
    RefreshCw,
    Database,
    ShoppingCart,
    Clock,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Activity,
    Wifi,
    WifiOff
} from 'lucide-react';

interface AcidMetrics {
    status: 'healthy' | 'degraded' | 'error';
    timestamp: string;
    metrics: {
        cartReservations: {
            active: number;
            expired: number;
        };
        stockMovements: {
            lastHour: number;
        };
        offlineSync: {
            pending: number;
        };
        database: {
            connected: boolean;
        };
    };
    issues?: string[];
    error?: string;
}

export function AcidDashboardClient() {
    const [metrics, setMetrics] = useState<AcidMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchMetrics = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/health/acid');
            const data = await response.json();
            setMetrics(data);
            setLastRefresh(new Date());
        } catch (error) {
            setMetrics({
                status: 'error',
                timestamp: new Date().toISOString(),
                metrics: {
                    cartReservations: { active: 0, expired: 0 },
                    stockMovements: { lastHour: 0 },
                    offlineSync: { pending: 0 },
                    database: { connected: false }
                },
                error: 'Failed to fetch metrics'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(fetchMetrics, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [autoRefresh, fetchMetrics]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-500';
            case 'degraded': return 'bg-yellow-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <Activity className="h-5 w-5 text-gray-500" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Status Header */}
            <Card>
                <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`h-4 w-4 rounded-full ${metrics ? getStatusColor(metrics.status) : 'bg-gray-300'} animate-pulse`} />
                            <div>
                                <h2 className="text-xl font-bold capitalize">
                                    {metrics?.status || 'Loading...'}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Last check: {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant={autoRefresh ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAutoRefresh(!autoRefresh)}
                            >
                                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={fetchMetrics}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Database Connection */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Base de Datos
                        </CardTitle>
                        <Database className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {metrics?.metrics.database.connected ? (
                                <>
                                    <Wifi className="h-5 w-5 text-green-500" />
                                    <span className="text-2xl font-bold text-green-600">Conectada</span>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="h-5 w-5 text-red-500" />
                                    <span className="text-2xl font-bold text-red-600">Desconectada</span>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Cart Reservations */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Reservaciones Activas
                        </CardTitle>
                        <ShoppingCart className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metrics?.metrics.cartReservations.active ?? '-'}
                        </div>
                        {metrics?.metrics.cartReservations.expired ? (
                            <p className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3" />
                                {metrics.metrics.cartReservations.expired} expiradas sin limpiar
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">
                                Carritos con soft-lock
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Stock Movements */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Movimientos (1hr)
                        </CardTitle>
                        <Activity className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metrics?.metrics.stockMovements.lastHour ?? '-'}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Transacciones de inventario
                        </p>
                    </CardContent>
                </Card>

                {/* Offline Pending */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Sync Pendiente
                        </CardTitle>
                        <Clock className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metrics?.metrics.offlineSync.pending ?? '-'}
                        </div>
                        {(metrics?.metrics.offlineSync.pending ?? 0) > 5 ? (
                            <p className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3" />
                                Cola alta - revisar conectividad
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 mt-1">
                                Transacciones offline
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Issues */}
            {metrics?.issues && metrics.issues.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                    <CardHeader>
                        <CardTitle className="text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Alertas Activas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {metrics.issues.map((issue, i) => (
                                <li key={i} className="flex items-start gap-2 text-yellow-700 dark:text-yellow-300">
                                    <span className="text-yellow-500">•</span>
                                    {issue}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {metrics?.error && (
                <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                    <CardContent className="py-6">
                        <div className="flex items-center gap-3 text-red-600">
                            <XCircle className="h-6 w-6" />
                            <span className="font-medium">{metrics.error}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Legend */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Leyenda de Estados</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-green-500" />
                            <span>Healthy: Todo funcionando correctamente</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-yellow-500" />
                            <span>Degraded: Problemas menores detectados</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-red-500" />
                            <span>Error: Falla crítica del sistema</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
