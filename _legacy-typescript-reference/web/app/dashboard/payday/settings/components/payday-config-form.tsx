"use client";

import { useState } from "react";
import { PaydayConfig } from "@prisma/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { upsertPaydayConfig } from "@/features/payday/actions/config";

export function PaydayConfigForm({ initialConfig, clientId }: { initialConfig: PaydayConfig | null, clientId: string }) {
    // Default values if no config exists
    const [config, setConfig] = useState({
        commercialZone: initialConfig?.commercialZone || "NORMAL",
        payFrequency: initialConfig?.payFrequency || "BIWEEKLY",
        // operationalHours...
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        // Cast types carefully
        const res = await upsertPaydayConfig({
            clientId,
            commercialZone: config.commercialZone as "NORMAL" | "ZONA_FRANCA" | "CASINO" | "HOTEL",
            payFrequency: config.payFrequency as "WEEKLY" | "BIWEEKLY" | "MONTHLY"
        });
        setIsSaving(false);
        if (res.success) {
            alert("Configuración guardada correctamente");
        } else {
            alert("Error al guardar");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración Global</CardTitle>
                <CardDescription>Parámetros generales de la empresa para nómina.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label>Zona Comercial / Tipo de Empresa</Label>
                    <Select
                        value={config.commercialZone}
                        onValueChange={(val) => setConfig({ ...config, commercialZone: val })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione zona" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NORMAL">Empresa Normal</SelectItem>
                            <SelectItem value="ZONA_FRANCA">Zona Franca</SelectItem>
                            <SelectItem value="CASINO">Casino / Juegos de Azar</SelectItem>
                            <SelectItem value="HOTEL">Hotel / Turismo</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Define las reglas base de horas extra y recargos según el código de trabajo.</p>
                </div>

                <div className="grid gap-2">
                    <Label>Frecuencia de Pago Predeterminada</Label>
                    <Select
                        value={config.payFrequency}
                        onValueChange={(val) => setConfig({ ...config, payFrequency: val as any })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="WEEKLY">Semanal</SelectItem>
                            <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                            <SelectItem value="MONTHLY">Mensual</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="pt-4 border-t">
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
