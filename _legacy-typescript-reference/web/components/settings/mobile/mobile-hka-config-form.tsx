'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
    Loader2,
    Save,
    Key,
    Building,
    MapPin,
    Settings,
} from 'lucide-react';
import { toast } from 'sonner';

import { MobileConfigCard } from './mobile-config-card';
import { MobileInputField } from './mobile-input-field';
import { MobileSelectField } from './mobile-select-field';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { MobileHeader } from '@/components/dashboard/mobile-header';
import { DocumentCreator } from '@/features/invoicing/ui/document-creator';
import { LocationSelect } from '@shared/ui/location-select';
import { InvoiceNumberingConfig } from '@/components/settings/invoice-numbering-config';

import {
    updateClientHkaSettings,
    getClientHkaSettings,
} from '@/app/actions/settings/client-hka-settings.action';
import {
    hkaSettingsSchema,
    type HkaSettingsInput
} from '@/app/actions/settings/hka-settings.schema';

interface MobileHkaConfigFormProps {
    userName: string;
}

export function MobileHkaConfigForm({ userName }: MobileHkaConfigFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showManualGenerator, setShowManualGenerator] = useState(false);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<HkaSettingsInput>({
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
                    reset({
                        ...result.data,
                        hkaTokenPassword: '',
                    });
                } else {
                    toast.error('No se pudo cargar la configuración');
                }
            } catch (error) {
                console.error(error);
                toast.error('Error de conexión al cargar configuración');
            } finally {
                setIsLoading(false);
            }
        }

        loadSettings();
    }, [reset]);

    async function onSubmit(data: HkaSettingsInput) {
        setIsSaving(true);
        try {
            const result = await updateClientHkaSettings(data);
            if (result.success) {
                toast.success('Configuración guardada exitosamente');
                reset({ ...data, hkaTokenPassword: '' });
            } else {
                toast.error(result.error || 'No se pudo guardar la configuración');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error inesperado al guardar');
        } finally {
            setIsSaving(false);
        }
    }



    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 pb-36">
                {/* Consistent Mobile Header */}
                <MobileHeader userName={userName} />

                {/* Page Title */}
                <div className="sticky top-[60px] z-10 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 py-4 border-b border-gray-200 dark:border-slate-900">
                    <h1 className="font-bold text-xl text-gray-900 dark:text-white">Configuración</h1>
                </div>

                <form onSubmit={handleSubmit(onSubmit as any)}>
                    <main className="px-4 pt-6 space-y-6">
                        {/* Invoice Numbering Configuration */}
                        <InvoiceNumberingConfig variant="mobile" />

                        {/* Card 1: HKA Authentication */}
                        <MobileConfigCard
                            title="Conexión HKA"
                            description="Credenciales de tu Proveedor Autorizado (PAC)."
                            icon={Key}
                            iconColor="text-blue-500"
                        >
                            <MobileInputField
                                label="Token Empresa (Usuario)"
                                placeholder="Ej. walgofugitj_ws_tfhka"
                                error={errors.hkaTokenUser?.message}
                                {...register('hkaTokenUser')}
                            />

                            <MobileInputField
                                label="Token Password"
                                placeholder="••••••••••••••••"
                                showPasswordToggle
                                description="Dejar en blanco para mantener la contraseña actual"
                                error={errors.hkaTokenPassword?.message}
                                {...register('hkaTokenPassword')}
                            />


                            {/* Verify Button Removed */}
                        </MobileConfigCard>

                        {/* Card 2: Branch Data */}
                        <MobileConfigCard
                            title="Datos de Sucursal"
                            description="Configuración de la sucursal y punto de facturación."
                            icon={Building}
                            iconColor="text-emerald-500"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <MobileInputField
                                    label="Cód. Sucursal"
                                    placeholder="0000"
                                    maxLength={4}
                                    description="0000 = Matriz"
                                    error={errors.branchCode?.message}
                                    {...register('branchCode')}
                                />

                                <MobileInputField
                                    label="Punto Fact. Fiscal"
                                    placeholder="001"
                                    maxLength={3}
                                    description="001-999"
                                    error={errors.puntoFacturacionFiscal?.message}
                                    {...register('puntoFacturacionFiscal')}
                                />
                            </div>

                            <Controller
                                name="tipoSucursal"
                                control={control}
                                render={({ field }) => (
                                    <MobileSelectField
                                        label="Tipo Sucursal"
                                        error={errors.tipoSucursal?.message}
                                        {...field}
                                    >
                                        <option value="1">Retail (Al por menor)</option>
                                        <option value="2">Mayorista</option>
                                    </MobileSelectField>
                                )}
                            />
                        </MobileConfigCard>

                        {/* Card 3: Location */}
                        <MobileConfigCard
                            title="Ubicación"
                            description="Valores por defecto para la emisión de documentos (Avanzado)."
                            icon={MapPin}
                            iconColor="text-amber-500"
                        >
                            <Controller
                                name="locationCode"
                                control={control}
                                render={({ field }) => (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-400 ml-1">
                                            Provincia - Distrito - Corregimiento
                                        </label>
                                        <LocationSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            required={true}
                                        />
                                    </div>
                                )}
                            />
                        </MobileConfigCard>

                        {/* Card 4: Technical Settings (Advanced) */}
                        <MobileConfigCard
                            title="Configuración Técnica"
                            description="Valores avanzados de emisión (Opcional)."
                            icon={Settings}
                            iconColor="text-slate-400"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <Controller
                                    name="tipoEmision"
                                    control={control}
                                    render={({ field }) => (
                                        <MobileSelectField label="Tipo Emisión" {...field}>
                                            <option value="01">01 - Normal</option>
                                            <option value="02">02 - Contingencia</option>
                                        </MobileSelectField>
                                    )}
                                />

                                <Controller
                                    name="destinoOperacion"
                                    control={control}
                                    render={({ field }) => (
                                        <MobileSelectField label="Destino" {...field}>
                                            <option value="1">1 - Panamá</option>
                                            <option value="2">2 - Extranjero</option>
                                        </MobileSelectField>
                                    )}
                                />

                                <Controller
                                    name="formatoCAFE"
                                    control={control}
                                    render={({ field }) => (
                                        <MobileSelectField label="Formato CAFE" {...field}>
                                            <option value="1">Sin CAFE</option>
                                            <option value="2">Con CAFE</option>
                                            <option value="3">Simplificado</option>
                                        </MobileSelectField>
                                    )}
                                />

                                <Controller
                                    name="entregaCAFE"
                                    control={control}
                                    render={({ field }) => (
                                        <MobileSelectField label="Entrega CAFE" {...field}>
                                            <option value="1">Sin CAFE</option>
                                            <option value="2">Correo</option>
                                            <option value="3">Impreso</option>
                                        </MobileSelectField>
                                    )}
                                />

                                <div className="col-span-2">
                                    <Controller
                                        name="envioContenedor"
                                        control={control}
                                        render={({ field }) => (
                                            <MobileSelectField label="Contenedor" {...field}>
                                                <option value="1">Normal</option>
                                                <option value="2">Comprimido</option>
                                            </MobileSelectField>
                                        )}
                                    />
                                </div>
                            </div>
                        </MobileConfigCard>
                    </main>

                    {/* Fixed Save Button */}
                    <div className="fixed bottom-[70px] left-0 right-0 px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-gray-200 dark:border-slate-900 z-20">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save size={22} />
                                    Guardar Cambios
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <BottomNav />
            </div>

            {/* Invoice Generator Modal */}
            <DocumentCreator
                isOpen={showManualGenerator}
                onClose={() => setShowManualGenerator(false)}
                onSuccess={() => router.refresh()}
            />
        </>
    );
}
