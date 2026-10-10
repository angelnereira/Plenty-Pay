'use client';

import { useState } from 'react';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { FoliosVisualizer } from '@/features/hka/ui/folios-visualizer';
import { RucVisualizer } from '@/features/hka/ui/ruc-visualizer';
import { RefreshCw } from 'lucide-react';
import type { FoliosRestantesResponse, ConsultarRucDVResponse } from '@/features/hka/model/types/types';

export default function HKAVisualizersPage() {
    const [foliosLoading, setFoliosLoading] = useState(false);
    const [rucLoading, setRucLoading] = useState(false);

    const [foliosData, setFoliosData] = useState<FoliosRestantesResponse | null>(null);
    const [rucData, setRucData] = useState<ConsultarRucDVResponse | null>(null);

    const fetchFolios = async () => {
        setFoliosLoading(true);
        try {
            const response = await fetch('/api/hka/folios-restantes');
            const data = await response.json();

            if (data.success && data.data) {
                setFoliosData(data.data);
            }
        } catch (error) {
            console.error('Error fetching folios:', error);
        } finally {
            setFoliosLoading(false);
        }
    };

    const fetchRuc = async () => {
        setRucLoading(true);
        try {
            const response = await fetch('/api/hka/consultar-ruc?ruc=155596713-2-2015&tipo=2');
            const data = await response.json();

            if (data.success && data.data) {
                setRucData(data.data);
            }
        } catch (error) {
            console.error('Error fetching RUC:', error);
        } finally {
            setRucLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold">Visualizadores HKA</h1>
                    <p className="text-muted-foreground mt-2">
                        Respuestas del servicio HKA visualizadas como en Postman
                    </p>
                </div>
            </div>

            <Tabs defaultValue="folios" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="folios">Folios Restantes</TabsTrigger>
                    <TabsTrigger value="ruc">Consultar RUC</TabsTrigger>
                </TabsList>

                {/* Folios Restantes */}
                <TabsContent value="folios" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Consultar Folios Disponibles</CardTitle>
                                    <CardDescription>
                                        Método: FoliosRestantes - Consulta folios disponibles en la licencia HKA
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={fetchFolios}
                                    disabled={foliosLoading}
                                    className="gap-2"
                                >
                                    <RefreshCw className={foliosLoading ? 'animate-spin' : ''} size={16} />
                                    Consultar
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>

                    {foliosData ? (
                        <FoliosVisualizer data={foliosData} loading={foliosLoading} />
                    ) : (
                        <Card>
                            <CardContent className="flex items-center justify-center h-64">
                                <div className="text-center space-y-4">
                                    <p className="text-muted-foreground">
                                        Haz click en "Consultar" para ver la información de folios
                                    </p>
                                    <Button onClick={fetchFolios} disabled={foliosLoading}>
                                        Consultar Folios
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Consultar RUC */}
                <TabsContent value="ruc" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Consultar RUC DV</CardTitle>
                                    <CardDescription>
                                        Método: ConsultarRucDV - Valida RUC y obtiene dígito verificador de la DGI
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={fetchRuc}
                                    disabled={rucLoading}
                                    className="gap-2"
                                >
                                    <RefreshCw className={rucLoading ? 'animate-spin' : ''} size={16} />
                                    Consultar
                                </Button>
                            </div>
                        </CardHeader>
                    </Card>

                    {rucData ? (
                        <RucVisualizer data={rucData as any} loading={rucLoading} />
                    ) : (
                        <Card>
                            <CardContent className="flex items-center justify-center h-64">
                                <div className="text-center space-y-4">
                                    <p className="text-muted-foreground">
                                        Haz click en "Consultar" para validar un RUC de ejemplo
                                    </p>
                                    <Button onClick={fetchRuc} disabled={rucLoading}>
                                        Consultar RUC
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Instructions */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-lg">💡 Cómo usar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p>
                        <strong>1.</strong> Selecciona el método HKA que quieres probar
                    </p>
                    <p>
                        <strong>2.</strong> Click en "Consultar" para hacer la llamada real a HKA
                    </p>
                    <p>
                        <strong>3.</strong> La respuesta se muestra con el mismo estilo que los visualizers de Postman
                    </p>
                    <p className="text-muted-foreground mt-4">
                        Esta página consume las APIs del proyecto que a su vez llaman directamente a HKA.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
