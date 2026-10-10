"use client";

import { useEffect, useState } from "react";
import { updateSettingsAction, getSettingsAction } from "@/app/actions/config/update-settings.action";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/ui/card";
import { Label } from "@shared/ui/label";
import { Save, Loader2, Printer, CreditCard } from "lucide-react";
import { Switch } from "@shared/ui/switch";
import { Input } from "@shared/ui/input";
import { useToast } from "@shared/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";

interface PosConfig {
    posReceiptPrinter: string;
    posDefaultPaymentMethod: string;
    posShowImages: boolean;
    posEnableQuickCash: boolean;
    posBoxNumber: string;
    posBusinessLogo?: string;
    posCheckoutPreference: string;
}

const DEFAULT_CONFIG: PosConfig = {
    posReceiptPrinter: "",
    posDefaultPaymentMethod: "CASH",
    posShowImages: true,
    posEnableQuickCash: true,
    posBoxNumber: "001",
    posBusinessLogo: "",
    posCheckoutPreference: "ALWAYS_DGI",
};

export function PosSettingsForm() {
    const [config, setConfig] = useState<PosConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const keys = Object.keys(DEFAULT_CONFIG);
                const result = await getSettingsAction(keys);
                if (result.success && result.data) {
                    // Merge definitions
                    const merged = { ...DEFAULT_CONFIG };
                    Object.keys(result.data).forEach(k => {
                        if (result.data[k] !== undefined) {
                            // @ts-ignore
                            merged[k] = result.data[k];
                        }
                    });
                    setConfig(merged);
                }
            } catch (error) {
                console.error("Error loading settings", error);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            for (const [key, value] of Object.entries(config)) {
                await updateSettingsAction(key, value);
            }
            toast({
                title: "Configuración guardada",
                description: "La configuración del POS se ha actualizado.",
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

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 200 * 1024) { // 200KB limit
                toast({
                    variant: "destructive",
                    title: "Archivo muy grande",
                    description: "El logo para recibos debe pesar menos de 200KB para desempeño óptimo."
                });
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig(prev => ({ ...prev, posBusinessLogo: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-violet-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Generales</CardTitle>
                    <CardDescription>Configuración básica del terminal de punto de venta.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="printer-name">Nombre de Impresora (RawBT/QzTray)</Label>
                        <Input
                            id="printer-name"
                            value={config.posReceiptPrinter}
                            onChange={(e) => setConfig({ ...config, posReceiptPrinter: e.target.value })}
                            placeholder="Ej: POS-80"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            El nombre exacto de la impresora instalada en el equipo o red.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="emission-mode">Modo de Emisión (Al Cobrar)</Label>
                        <Select
                            value={config.posCheckoutPreference}
                            onValueChange={(value) => setConfig({ ...config, posCheckoutPreference: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccione modo de emisión" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALWAYS_ASK">Preguntar Siempre (Fiscal vs Interno)</SelectItem>
                                <SelectItem value="ALWAYS_DGI">Factura Fiscal Automática (DGI)</SelectItem>
                                <SelectItem value="INTERNAL_ONLY">Solo Interno (Sin Fiscalización)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                            Define qué sucede al presionar "COBRAR".
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="logo-upload">Logo del Negocio (Opcional)</Label>
                        <div className="flex items-center gap-4">
                            {config.posBusinessLogo && (
                                <div className="border rounded p-1 h-16 w-16 flex items-center justify-center bg-gray-50">
                                    <img src={config.posBusinessLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                                </div>
                            )}
                            <div className="flex-1">
                                <Input
                                    id="logo-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="cursor-pointer"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Recomendado: Imagen cuadrada o rectangular pequeña (max 200KB). Se usará en recibos térmicos y PDFs.
                                    Si ya existe, subir una nueva reemplazará la anterior.
                                </p>
                                {config.posBusinessLogo && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 h-6 text-xs text-red-500 hover:text-red-700"
                                        onClick={() => setConfig(prev => ({ ...prev, posBusinessLogo: "" }))}
                                    >
                                        Eliminar Logo
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Pagos y Caja
                    </CardTitle>
                    <CardDescription>Preferencias para agilizar el cobro.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label>Método de Pago por Defecto</Label>
                        <Select
                            value={config.posDefaultPaymentMethod}
                            onValueChange={(v) => setConfig(prev => ({ ...prev, posDefaultPaymentMethod: v }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CASH">Efectivo</SelectItem>
                                <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                                <SelectItem value="DEBIT_CARD">Tarjeta de Débito</SelectItem>
                                <SelectItem value="OTHER">Otros (Yappy/Transferencia)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="show-images" className="flex flex-col space-y-1">
                            <span>Mostrar Imágenes de Productos</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Visualizar miniaturas en el buscador del POS.
                            </span>
                        </Label>
                        <Switch
                            id="show-images"
                            checked={config.posShowImages}
                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, posShowImages: c }))}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="quick-cash" className="flex flex-col space-y-1">
                            <span>Habilitar Cobro Rápido</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Botones de cobro directo para montos exactos en efectivo.
                            </span>
                        </Label>
                        <Switch
                            id="quick-cash"
                            checked={config.posEnableQuickCash}
                            onCheckedChange={(c) => setConfig(prev => ({ ...prev, posEnableQuickCash: c }))}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="box-number">Número de Caja</Label>
                        <Input
                            id="box-number"
                            placeholder="Ej: 001"
                            maxLength={3}
                            className="max-w-[100px]"
                            value={config.posBoxNumber}
                            onChange={(e) => setConfig(prev => ({ ...prev, posBoxNumber: e.target.value }))}
                        />
                        <p className="text-sm text-muted-foreground">
                            Identificador único de esta terminal (001, 002...).
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Configuración
                </Button>
            </div>
        </div>
    );
}
