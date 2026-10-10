'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Key, Building, Settings } from 'lucide-react';

import { useToast } from "@shared/hooks/use-toast";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@shared/ui/card';
import { CollapsibleCard } from '@shared/ui/collapsible-card';
import { Input } from '@shared/ui/input';
import { Button } from '@shared/ui/button';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@shared/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@shared/ui/select";

import {
    updateClientHkaSettings,
    getClientHkaSettings,
} from '@/app/actions/settings/client-hka-settings.action';
import {
    hkaSettingsSchema,
    type HkaSettingsInput
} from '@/app/actions/settings/hka-settings.schema';
import { LocationSelect } from '@shared/ui/location-select';

export function HkaConfigForm() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const form = useForm<HkaSettingsInput>({
        resolver: zodResolver(hkaSettingsSchema) as any,
        defaultValues: {
            hkaTokenUser: '',
            hkaTokenPassword: '',
            branchCode: '0000',
            locationCode: '1-1-1',
            tipoSucursal: '1',
            puntoFacturacionFiscal: '001',
            tipoEmision: '01',
            destinoOperacion: '1',
            formatoCAFE: '1',
            entregaCAFE: '1',
            envioContenedor: '1',
            procesoGeneracion: '1',
        },
    });

    useEffect(() => {
        async function loadSettings() {
            try {
                const result = await getClientHkaSettings();
                if (result.success && result.data) {
                    form.reset({
                        ...result.data,
                        hkaTokenPassword: '', // No mostrar password
                    });
                } else {
                    toast({
                        title: "Error",
                        description: "No se pudo cargar la configuración.",
                        variant: "destructive",
                    });
                }
            } catch (error) {
                console.error(error);
                toast({
                    title: "Error",
                    description: "Error de conexión al cargar configuración.",
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        }

        loadSettings();
    }, [form, toast]);

    async function onSubmit(data: HkaSettingsInput) {
        setIsSaving(true);
        try {
            const result = await updateClientHkaSettings(data);
            if (result.success) {
                toast({
                    title: "Configuración guardada",
                    description: "Los cambios han sido aplicados exitosamente.",
                });
                // Limpiar campo de password después de guardar
                form.setValue('hkaTokenPassword', '');
            } else {
                toast({
                    title: "Error",
                    description: result.error || "No se pudo guardar la configuración.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "Error inesperado al guardar.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">

                {/* Autenticación HKA */}
                <CollapsibleCard
                    title="Autenticación HKA"
                    description="Credenciales proporcionadas por The Factory HKA (PAC)."
                    icon={Key}
                    iconColor="text-blue-500"
                    defaultExpanded={false}
                >
                    <div className="grid gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control as any}
                            name="hkaTokenUser"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Token Empresa (Usuario)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: 155738031-2-2025" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control as any}
                            name="hkaTokenPassword"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Token Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="••••••••" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Dejar en blanco para mantener la contraseña actual.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </CollapsibleCard>

                {/* Datos del Emisor */}
                <CollapsibleCard
                    title="Datos del Emisor"
                    description="Configuración de la sucursal y punto de facturación."
                    icon={Building}
                    iconColor="text-emerald-500"
                    defaultExpanded={false}
                >
                    <div className="grid gap-6 md:grid-cols-3">
                        <FormField
                            control={form.control as any}
                            name="branchCode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cód. Sucursal</FormLabel>
                                    <FormControl>
                                        <Input placeholder="0000" maxLength={4} {...field} />
                                    </FormControl>
                                    <FormDescription>0000 = Matriz</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control as any}
                            name="tipoSucursal"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo Sucursal</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">Retail (Al por menor)</SelectItem>
                                            <SelectItem value="2">Mayorista</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control as any}
                            name="puntoFacturacionFiscal"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Punto Fact. Fiscal</FormLabel>
                                    <FormControl>
                                        <Input placeholder="001" maxLength={3} {...field} />
                                    </FormControl>
                                    <FormDescription>001-999</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control as any}
                            name="locationCode"
                            render={({ field }) => (
                                <FormItem className="col-span-1 md:col-span-3">
                                    <FormLabel>Ubicación (Provincia - Distrito - Corregimiento)</FormLabel>
                                    <FormControl>
                                        <LocationSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            required={true}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </CollapsibleCard>

                {/* Configuración Técnica (Avanzada) */}
                <CollapsibleCard
                    title="Configuración Técnica"
                    description="Valores por defecto para la emisión de documentos (Avanzado)."
                    icon={Settings}
                    iconColor="text-slate-500"
                    defaultExpanded={false}
                >
                    <div className="grid gap-6 md:grid-cols-3">
                        <FormField
                            control={form.control as any}
                            name="tipoEmision"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo Emisión</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="01">01 - Operación Normal</SelectItem>
                                            <SelectItem value="02">02 - Contingencia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control as any}
                            name="destinoOperacion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Destino Operación</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">1 - Panamá</SelectItem>
                                            <SelectItem value="2">2 - Extranjero</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control as any}
                            name="procesoGeneracion"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proceso Generación</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="1">1 - Sistema Propio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={form.control as any}
                                name="formatoCAFE"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Formato CAFE</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Sin CAFE</SelectItem>
                                                <SelectItem value="2">2 - Con CAFE</SelectItem>
                                                <SelectItem value="3">3 - CAFE Simplificado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control as any}
                                name="entregaCAFE"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Entrega CAFE</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Sin CAFE</SelectItem>
                                                <SelectItem value="2">2 - Correo</SelectItem>
                                                <SelectItem value="3">3 - Impreso</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control as any}
                                name="envioContenedor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Envío Contenedor</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Normal</SelectItem>
                                                <SelectItem value="2">2 - Comprimido</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </CollapsibleCard>

                <div className="flex justify-end">
                    <Button type="submit" size="lg" disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Guardar Configuración
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </Form >
    );
}
