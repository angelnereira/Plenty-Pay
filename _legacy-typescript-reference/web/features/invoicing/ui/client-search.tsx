'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Check, AlertCircle, User, Building2, RefreshCw } from 'lucide-react';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import { Card, CardContent } from '@shared/ui/card';
import { Badge } from '@shared/ui/badge';
import { Label } from '@shared/ui/label';

export interface ClientData {
    ruc: string;
    dv: string;
    razonSocial: string;
    tipoContribuyente: string;
    codigo?: string;
    mensaje?: string;
}

interface ClientSearchProps {
    onClientSelect: (client: ClientData) => void;
    initialRuc?: string;
    className?: string;
}

export function ClientSearch({ onClientSelect, initialRuc = '', className = '' }: ClientSearchProps) {
    const [ruc, setRuc] = useState(initialRuc);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [lastSearchedRuc, setLastSearchedRuc] = useState('');

    // Efecto para búsqueda automática con debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (ruc && ruc.length >= 5 && ruc !== lastSearchedRuc) {
                handleSearch();
            }
        }, 1000); // 1 segundo de espera

        return () => clearTimeout(timer);
    }, [ruc, lastSearchedRuc]);

    const handleSearch = async () => {
        if (!ruc.trim()) return;

        // Evitar búsquedas repetidas si no ha cambiado
        if (ruc === lastSearchedRuc && clientData) return;

        setIsLoading(true);
        setError(null);
        setClientData(null);
        setLastSearchedRuc(ruc);

        try {
            const response = await fetch(`/api/ruc/${encodeURIComponent(ruc)}/validate`);
            const data = await response.json();

            if (data.success) {
                const result = data.data;
                // Mapear respuesta del API a nuestra interfaz
                const foundClient: ClientData = {
                    ruc: result.ruc,
                    dv: result.dv,
                    razonSocial: result.nombre || result.razonSocial || 'NOMBRE NO DISPONIBLE',
                    tipoContribuyente: result.tipoContribuyente || 'N/A',
                    codigo: result.codigo,
                    mensaje: result.mensaje
                };

                setClientData(foundClient);

                // Si encontramos datos válidos, notificamos al padre automáticamente
                if (foundClient.dv) {
                    onClientSelect(foundClient);
                }
            } else {
                setError(data.error || 'No se encontraron datos para este RUC');
                // Si hay error, limpiamos la selección previa
                onClientSelect({ ruc, dv: '', razonSocial: '', tipoContribuyente: '' });
            }
        } catch (err) {
            console.error('Error buscando cliente:', err);
            setError('Error de conexión al validar RUC');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="space-y-2">
                <Label htmlFor="ruc-search">Buscar Cliente (RUC)</Label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            id="ruc-search"
                            placeholder="Ej: 155667788-2-2020"
                            value={ruc}
                            onChange={(e) => setRuc(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-9"
                            disabled={isLoading}
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={isLoading || !ruc.trim()}
                        variant="secondary"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            'Buscar'
                        )}
                    </Button>
                </div>
            </div>

            {/* Estados de Carga, Error y Éxito */}
            {isLoading && (
                <div className="flex items-center justify-center p-4 text-sm text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded-lg animate-pulse">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Consultando DGI / HKA...
                </div>
            )}

            {error && !isLoading && (
                <div className="flex items-center p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    {error}
                </div>
            )}

            {clientData && !isLoading && (
                <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10">
                    <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                                        {clientData.tipoContribuyente === 'JURIDICO' ? (
                                            <Building2 className="h-4 w-4" />
                                        ) : (
                                            <User className="h-4 w-4" />
                                        )}
                                        {clientData.razonSocial}
                                    </h4>
                                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                        Verificado
                                    </Badge>
                                </div>

                                <div className="text-sm text-gray-600 dark:text-gray-300 grid grid-cols-2 gap-x-8 gap-y-1 mt-2">
                                    <p>
                                        <span className="font-medium">RUC:</span> {clientData.ruc}
                                    </p>
                                    <p>
                                        <span className="font-medium">DV:</span> {clientData.dv}
                                    </p>
                                    <p>
                                        <span className="font-medium">Tipo:</span> {clientData.tipoContribuyente}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-8"
                                    onClick={handleSearch}
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" /> Actualizar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
