'use client';

import { useMemo } from 'react';
import { User, Building2, Info, CheckCircle2, Loader2, Zap, AlertCircle } from 'lucide-react';
import { validarFormatoRUC } from '@/lib/validations/ruc-validator';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';
import { Textarea } from '@shared/ui/textarea';
import { Button } from '@shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select';
import { cn } from '@/lib/utils';
import type { UseDocumentFormReturn } from '@/shared/hooks/use-document-form';
import { MotorEntityCombobox } from '@/components/motor/MotorEntityCombobox';
import type { MotorEntitySummary } from '@/shared/hooks/use-motor-search';
import { DuplicateLastInvoiceBanner } from '@/features/invoicing/ui/duplicate-last-invoice-banner';
import type { LastInvoiceSummary } from '@/shared/hooks/use-last-invoice';

// ── Constants ────────────────────────────────────────────────────────────────

const TIPOS_CLIENTE_FE = [
    { value: '01', label: 'Contribuyente' },
    { value: '02', label: 'Consumidor Final' },
    { value: '03', label: 'Gobierno' },
    { value: '04', label: 'Extranjero' },
];

const KIND_TO_TIPO: Record<string, string> = {
    PERSON: '02',
    COMPANY: '01',
    CLIENT: '01',
    SUPPLIER: '01',
    PARTNER: '01',
    PROSPECT: '02',
    INTERNAL: '01',
};

// ── RUC format validation (client-side, before HKA call) ────────────────────
//
// Panama DGI RUC formats:
//   Natural (tipoContribuyente=1):  digit(s)-digit(s)-digit(s)  e.g. 8-123-456
//   Jurídica (tipoContribuyente=2): digit(s)-digit(s)-digit(s)  e.g. 155599-1-404850
//   OR plain numeric:               7-10 digits
//
// This is a lightweight structural check; HKA does the authoritative DGI lookup.

function getRucFormatHint(tipoContribuyente: string): string {
    if (tipoContribuyente === '1') return 'Ej: 8-123-456 (Persona Natural)';
    if (tipoContribuyente === '2') return 'Ej: 155599-1-404850 ó 8-NT-1-22685';
    return 'Ej: 8-123-456';
}

function validateRucFormat(ruc: string, tipoContribuyente: string): string | null {
    if (!ruc.trim()) return null;
    if (!validarFormatoRUC(ruc)) {
        if (tipoContribuyente === '1') {
            return 'Formato esperado: 8-123-456 (con guiones)';
        }
        return 'Formato esperado: dígitos separados por guiones (ej: 155599-1-404850 ó 8-NT-1-22685)';
    }
    return null;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ClientStepProps {
    form: UseDocumentFormReturn;
    onDuplicate: (data: LastInvoiceSummary) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ClientStep({ form, onDuplicate }: ClientStepProps) {
    const { clientData, setClientData, rucValidation, validateRUC, markRucValid } = form;

    // Whether DV field should be shown: only for Contribuyente (01) and Gobierno (03)
    // Consumidor Final (02) → optional cédula, no DV
    // Extranjero (04)       → passport/ID field, no DV
    const showDV = clientData.tipoClienteFE === '01' || clientData.tipoClienteFE === '03';
    const showRucBlock = clientData.tipoClienteFE === '01' || clientData.tipoClienteFE === '03';
    const showCedula = clientData.tipoClienteFE === '02';
    const showPassport = clientData.tipoClienteFE === '04';

    // Real-time RUC format feedback
    const rucFormatError = useMemo(() => {
        if (!showRucBlock) return null;
        return validateRucFormat(clientData.numeroRUC, clientData.tipoContribuyente);
    }, [showRucBlock, clientData.numeroRUC, clientData.tipoContribuyente]);

    const handleTipoClienteChange = (value: string) => {
        if (value === '02' || value === '04') {
            // Clear DV for types that don't need it
            setClientData({ tipoClienteFE: value, digitoVerificadorRUC: '', motorEntityId: undefined });
        } else {
            setClientData({ tipoClienteFE: value, motorEntityId: undefined });
        }
    };

    const handleMotorEntitySelect = (entity: MotorEntitySummary) => {
        const tipo = KIND_TO_TIPO[entity.kind] ?? '02';
        const customFields = (entity.customFields ?? {}) as Record<string, unknown>;
        const ext = (customFields._ext ?? {}) as Record<string, unknown>;
        const dv = (customFields.dv || customFields.digitoVerificador || '') as string;

        let address = (customFields.address || customFields.direccion || '') as string;
        if (!address && ext.address) {
            const a = ext.address as Record<string, string>;
            address = [a.street, a.area, a.province].filter(Boolean).join(', ');
        }

        setClientData({
            tipoClienteFE: tipo,
            tipoContribuyente: entity.kind === 'COMPANY' ? '2' : '1',
            razonSocial: entity.displayName,
            numeroRUC: entity.documentNumber ?? '',
            digitoVerificadorRUC: dv,
            correoElectronico1: entity.primaryEmail ?? '',
            telefono1: entity.primaryPhone || '',
            direccion: address,
            motorEntityId: entity.id,
        });

        if (tipo === '02') {
            // No RUC validation needed
        } else if (entity.documentNumber) {
            markRucValid();
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Búsqueda rápida Motor Entidades ─────────────────────────── */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-violet-500" />
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Búsqueda rápida (Entidades y Clientes)
                    </Label>
                </div>
                <MotorEntityCombobox
                    placeholder="Buscar por nombre, RUC o email…"
                    onSelect={handleMotorEntitySelect}
                    preloadRecent
                />
                <p className="text-[10px] text-gray-400">
                    Selecciona una entidad registrada para pre-llenar los campos automáticamente.
                </p>
                <DuplicateLastInvoiceBanner
                    clientId={clientData.motorEntityId ?? null}
                    onDuplicate={onDuplicate}
                />
            </div>

            {/* ── Identificación ───────────────────────────────────────────── */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Identificación</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tipo de Cliente */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tipo de Cliente *
                        </Label>
                        <Select value={clientData.tipoClienteFE} onValueChange={handleTipoClienteChange}>
                            <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIPOS_CLIENTE_FE.map(tipo => (
                                    <SelectItem key={tipo.value} value={tipo.value}>
                                        {tipo.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Razón Social */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {clientData.tipoClienteFE === '04' ? 'Nombre completo *' :
                             clientData.tipoClienteFE === '02' ? 'Nombre (opcional)' : 'Razón Social *'}
                        </Label>
                        <Input
                            value={clientData.razonSocial}
                            onChange={(e) => setClientData({ razonSocial: e.target.value })}
                            placeholder={
                                clientData.tipoClienteFE === '02' ? 'Nombre del cliente' :
                                clientData.tipoClienteFE === '04' ? 'Nombre del extranjero' :
                                'Nombre completo / Razón Social'
                            }
                            className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                        />
                    </div>

                    {/* Cédula — Consumidor Final (02) */}
                    {showCedula && (
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Cédula (opcional)
                            </Label>
                            <Input
                                value={clientData.numeroRUC}
                                onChange={(e) => setClientData({ numeroRUC: e.target.value, motorEntityId: undefined })}
                                placeholder="Ej: 8-123-456 o 3703454"
                                className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                            />
                            <p className="text-[10px] text-gray-400">
                                Para Consumidor Final, la cédula es opcional pero recomendada.
                            </p>
                        </div>
                    )}

                    {/* Pasaporte / ID — Extranjero (04) */}
                    {showPassport && (
                        <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Pasaporte / Documento de Identidad (opcional)
                            </Label>
                            <Input
                                value={clientData.numeroRUC}
                                onChange={(e) => setClientData({ numeroRUC: e.target.value, motorEntityId: undefined })}
                                placeholder="Ej: PA1234567"
                                className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                            />
                            <p className="text-[10px] text-blue-500 dark:text-blue-400">
                                DGI: Para clientes extranjeros no se requiere DV ni validación de RUC.
                            </p>
                        </div>
                    )}

                    {/* RUC + DV — Contribuyente (01) y Gobierno (03) */}
                    {showRucBlock && (
                        <>
                            {/* Tipo Contribuyente */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Tipo Contribuyente *
                                </Label>
                                <Select
                                    value={clientData.tipoContribuyente}
                                    onValueChange={(value) => {
                                        // Reset RUC when changing contributor type — format changes
                                        setClientData({ tipoContribuyente: value, numeroRUC: '', digitoVerificadorRUC: '', motorEntityId: undefined });
                                    }}
                                >
                                    <SelectTrigger className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Persona Natural</SelectItem>
                                        <SelectItem value="2">Persona Jurídica</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* RUC field with real-time format validation */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    RUC * (sin DV)
                                </Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            value={clientData.numeroRUC}
                                            onChange={(e) => setClientData({
                                                numeroRUC: e.target.value,
                                                digitoVerificadorRUC: '',
                                                motorEntityId: undefined,
                                            })}
                                            placeholder={getRucFormatHint(clientData.tipoContribuyente)}
                                            className={cn(
                                                'bg-white dark:bg-slate-900 h-11 pl-4',
                                                rucFormatError
                                                    ? 'border-amber-400 ring-1 ring-amber-400'
                                                    : rucValidation.isValid === true
                                                        ? 'border-green-500 ring-1 ring-green-500'
                                                        : rucValidation.isValid === false
                                                            ? 'border-red-500 ring-1 ring-red-500'
                                                            : 'border-gray-200 dark:border-slate-800'
                                            )}
                                        />
                                        {rucValidation.isValid === true && !rucFormatError && (
                                            <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-500" />
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant={rucValidation.isValid === true ? 'outline' : 'secondary'}
                                        onClick={validateRUC}
                                        disabled={rucValidation.isValidating || !clientData.numeroRUC || !!rucFormatError}
                                        className="h-11 px-4 min-w-[100px]"
                                    >
                                        {rucValidation.isValidating
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : 'Validar'}
                                    </Button>
                                </div>

                                {/* Real-time format hint */}
                                {rucFormatError && clientData.numeroRUC.trim() && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                                        <AlertCircle className="h-3 w-3 shrink-0" />
                                        {rucFormatError}
                                    </p>
                                )}

                                {/* HKA validation error */}
                                {rucValidation.error && !rucFormatError && (
                                    <p className="text-xs text-red-500 pt-1">{rucValidation.error}</p>
                                )}
                            </div>

                            {/* DV — auto-filled after HKA validation */}
                            {showDV && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        DV (Dígito Verificador) *
                                    </Label>
                                    <Input
                                        value={clientData.digitoVerificadorRUC}
                                        onChange={(e) => setClientData({ digitoVerificadorRUC: e.target.value })}
                                        placeholder="Se completa al validar RUC"
                                        className={cn(
                                            'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11',
                                            rucValidation.isValid === true && clientData.digitoVerificadorRUC
                                                ? 'border-green-500'
                                                : ''
                                        )}
                                        readOnly={rucValidation.isValid === true}
                                    />
                                    {rucValidation.isValid === true && clientData.digitoVerificadorRUC && (
                                        <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            DV confirmado por la DGI vía HKA
                                        </p>
                                    )}
                                    {!clientData.digitoVerificadorRUC && (
                                        <p className="text-[10px] text-gray-400">
                                            Ingresa el RUC y presiona «Validar» para obtener el DV automáticamente.
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Ubicación y Contacto ─────────────────────────────────────── */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                    <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-medium text-gray-900 dark:text-white">Ubicación y Contacto</h3>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Dirección
                        </Label>
                        <Textarea
                            value={clientData.direccion}
                            onChange={(e) => setClientData({ direccion: e.target.value })}
                            placeholder="Dirección física del cliente"
                            className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 min-h-[80px]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Teléfono
                            </Label>
                            <Input
                                value={clientData.telefono1 ?? ''}
                                onChange={(e) => setClientData({ telefono1: e.target.value })}
                                placeholder="Opcional"
                                className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Email
                            </Label>
                            <Input
                                type="email"
                                value={clientData.correoElectronico1 ?? ''}
                                onChange={(e) => setClientData({ correoElectronico1: e.target.value })}
                                placeholder="Opcional"
                                className="bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 h-11"
                            />
                        </div>
                    </div>
                </div>

                {/* DGI compliance note */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex gap-2">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            {clientData.tipoClienteFE === '04' ? (
                                <><strong>Extranjero:</strong> No se requiere RUC ni DV. El número de pasaporte es opcional.</>
                            ) : clientData.tipoClienteFE === '02' ? (
                                <><strong>Consumidor Final:</strong> Nombre y cédula son opcionales. No se requiere RUC ni DV.</>
                            ) : (
                                <><strong>Contribuyente / Gobierno:</strong> El RUC y el DV son obligatorios. Usa «Validar» para confirmar con la DGI.</>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
