"use client";

import { useEffect, useState } from "react";
import { updateSettingsAction, getSettingsAction } from "@/app/actions/config/update-settings.action";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/ui/card";
import { Label } from "@shared/ui/label";
import { AlertCircle, Save, Loader2 } from "lucide-react";
import { Switch } from "@shared/ui/switch";
import { Input } from "@shared/ui/input";
import { useToast } from "@shared/hooks/use-toast";

interface InventoryConfig {
    enableLowStockAlerts: boolean;
    lowStockThreshold: number;
    enableNegativeStock: boolean;
    enableBatchTracking: boolean;
}

const DEFAULT_CONFIG: InventoryConfig = {
    enableLowStockAlerts: true,
    lowStockThreshold: 10,
    enableNegativeStock: false,
    enableBatchTracking: true,
};

export function InventorySettingsForm() {
    const [config, setConfig] = useState<InventoryConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const keys = Object.keys(DEFAULT_CONFIG);
            const res = await getSettingsAction(keys);
            if (res.success && res.data) {
                // Merge defects with loaded data to ensure type safety
                setConfig(prev => ({
                    ...prev,
                    ...res.data
                }));
            }
        } catch (error) {
            console.error("Failed to load settings", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo cargar la configuración."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save each key strictly
            for (const [key, value] of Object.entries(config)) {
                await updateSettingsAction(key, value);
            }
            toast({
                title: "Configuración guardada",
                description: "Los cambios se han aplicado correctamente.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron guardar los cambios."
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Alertas y Notificaciones</CardTitle>
                    <CardDescription>Configura cuándo quieres recibir avisos sobre tu inventario.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="low-stock" className="flex flex-col space-y-1">
                            <span>Alertas de Stock Bajo</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Recibir correos cuando un producto esté por agotarse.
                            </span>
                        </Label>
                        <Switch
                            id="low-stock"
                            checked={config.enableLowStockAlerts}
                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, enableLowStockAlerts: c }))}
                        />
                    </div>

                    {config.enableLowStockAlerts && (
                        <div className="grid gap-2">
                            <Label htmlFor="threshold">Umbral de Stock Mínimo (Global)</Label>
                            <Input
                                id="threshold"
                                type="number"
                                className="max-w-[200px]"
                                value={config.lowStockThreshold}
                                onChange={(e) => setConfig(prev => ({ ...prev, lowStockThreshold: parseInt(e.target.value) || 0 }))}
                            />
                            <p className="text-sm text-muted-foreground">
                                Si un producto baja de esta cantidad, se enviará la alerta (salvo que tenga un umbral específico).
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Reglas de Negocio</CardTitle>
                    <CardDescription>Controla cómo se comporta el inventario ante movimientos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="negative-stock" className="flex flex-col space-y-1">
                            <span>Permitir Stock Negativo</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Permitir ventas de productos sin stock disponible.
                            </span>
                        </Label>
                        <Switch
                            id="negative-stock"
                            checked={config.enableNegativeStock}
                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, enableNegativeStock: c }))}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="batch-tracking" className="flex flex-col space-y-1">
                            <span>Control de Lotes y Vencimiento</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Habilitar la gestión de lotes para productos perecederos.
                            </span>
                        </Label>
                        <Switch
                            id="batch-tracking"
                            checked={config.enableBatchTracking}
                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, enableBatchTracking: c }))}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Cambios
                </Button>
            </div>
        </div>
    );
}
