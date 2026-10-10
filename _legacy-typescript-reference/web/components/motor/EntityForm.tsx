"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEntity, updateEntity } from "@/actions/motor/entities";
import { toCents } from "@/lib/motor/money";
import type { MotorFieldType, MotorFieldKindScope, MotorEntityKind } from "@prisma/client";
import {
    User, Building2, ChevronRight, ChevronLeft, Check,
    Phone, Mail, MapPin, Briefcase, CreditCard, Users,
    DollarSign, FileText, Calendar, Percent, UserCheck,
    AlertCircle, Home, Shield,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PANAMA_PROVINCES = [
    "Bocas del Toro", "Coclé", "Colón", "Chiriquí", "Darién",
    "Herrera", "Los Santos", "Panamá", "Panamá Oeste", "Veraguas",
    "Comarca Emberá", "Comarca Guna Yala", "Comarca Ngäbe-Buglé",
];

const REFERENCE_RELATIONSHIPS = [
    "Familiar", "Amigo/Amiga", "Compañero de trabajo", "Vecino", "Otro",
];

const DOC_TYPES = [
    { value: "CEDULA", label: "Cédula" },
    { value: "RUC", label: "RUC" },
    { value: "PASSPORT", label: "Pasaporte" },
    { value: "OTHER", label: "Otro" },
];

const SALARY_FREQUENCIES = [
    { value: "weekly", label: "Semanal" },
    { value: "biweekly", label: "Quincenal" },
    { value: "monthly", label: "Mensual" },
];

const PAYMENT_CYCLES = [
    { value: "weekly", label: "Semanal" },
    { value: "biweekly", label: "Quincenal" },
    { value: "monthly", label: "Mensual" },
];

const WIZARD_STEPS = [
    { label: "Tipo", icon: User },
    { label: "Básico", icon: FileText },
    { label: "Dirección", icon: MapPin },
    { label: "Crédito", icon: CreditCard },
    { label: "Referencias", icon: Users },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDef {
    id: string;
    slug: string;
    label: string;
    type: MotorFieldType;
    required: boolean;
    options: { value: string; label: string }[] | null;
    kindScope: MotorFieldKindScope;
}

interface InitialEntity {
    id: string;
    kind: MotorEntityKind;
    displayName: string;
    documentType: string | null;
    documentNumber: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    creditLimitCents: string | null;
    paymentDueAt: string | null;
    isActive: boolean;
    customFields: Record<string, string | number | boolean | null> | null;
}

interface Props {
    mode: "create" | "edit";
    definitions: FieldDef[];
    initial?: InitialEntity;
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors";

const selectCls = `${inputCls} cursor-pointer`;

function Pill({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}

function Field({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
                {label}
                {required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
    const { className, ...rest } = props;
    return <input {...rest} className={`${inputCls} ${className ?? ""}`} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EntityForm({ mode, definitions, initial }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // ── Edit mode flat state ──────────────────────────────────────────────────
    const [editKind] = useState<MotorEntityKind>(initial?.kind ?? "PERSON");
    const [editName, setEditName] = useState(initial?.displayName ?? "");
    const [editDocType, setEditDocType] = useState(initial?.documentType ?? "");
    const [editDocNum, setEditDocNum] = useState(initial?.documentNumber ?? "");
    const [editEmail, setEditEmail] = useState(initial?.primaryEmail ?? "");
    const [editPhone, setEditPhone] = useState(initial?.primaryPhone ?? "");
    const [editCreditLimit, setEditCreditLimit] = useState(
        initial?.creditLimitCents ? (BigInt(initial.creditLimitCents) / 100n).toString() : ""
    );
    const [editPaymentDue, setEditPaymentDue] = useState(
        initial?.paymentDueAt ? initial.paymentDueAt.slice(0, 10) : ""
    );
    const [editIsActive, setEditIsActive] = useState(initial?.isActive ?? true);
    const [editCustomFields, setEditCustomFields] = useState<
        Record<string, string | number | boolean | null>
    >(initial?.customFields ?? {});

    // ── Wizard state ──────────────────────────────────────────────────────────
    const [step, setStep] = useState(0);

    // Step 0: tipo
    const [wizKind, setWizKind] = useState<MotorEntityKind>("PERSON");

    // Step 1: básico
    const [wizName, setWizName] = useState("");
    const [wizDocType, setWizDocType] = useState("CEDULA");
    const [wizDocNum, setWizDocNum] = useState("");
    const [wizEmail, setWizEmail] = useState("");
    const [wizPhone, setWizPhone] = useState("");
    const [wizCustomFields, setWizCustomFields] = useState<
        Record<string, string | number | boolean | null>
    >({});

    // Step 2: dirección
    const [wizProvince, setWizProvince] = useState("");
    const [wizArea, setWizArea] = useState("");
    const [wizStreet, setWizStreet] = useState("");

    // Step 3: empleo & crédito
    const [wizWorkplace, setWizWorkplace] = useState("");
    const [wizPosition, setWizPosition] = useState("");
    const [wizSalaryAmount, setWizSalaryAmount] = useState("");
    const [wizSalaryFreq, setWizSalaryFreq] = useState("monthly");
    const [wizCreditLimit, setWizCreditLimit] = useState("");
    const [wizInterestRate, setWizInterestRate] = useState("");
    const [wizPaymentCycle, setWizPaymentCycle] = useState("monthly");
    const [wizPaymentDay, setWizPaymentDay] = useState("15");
    const [wizPaymentDueDate, setWizPaymentDueDate] = useState("");

    // Step 4: referencias & fiador
    const [wizRef1Name, setWizRef1Name] = useState("");
    const [wizRef1Phone, setWizRef1Phone] = useState("");
    const [wizRef1Rel, setWizRef1Rel] = useState("Familiar");
    const [wizRef2Name, setWizRef2Name] = useState("");
    const [wizRef2Phone, setWizRef2Phone] = useState("");
    const [wizRef2Rel, setWizRef2Rel] = useState("Familiar");
    const [wizFiadorName, setWizFiadorName] = useState("");
    const [wizFiadorPhone, setWizFiadorPhone] = useState("");
    const [wizFiadorDocType, setWizFiadorDocType] = useState("CEDULA");
    const [wizFiadorDocNum, setWizFiadorDocNum] = useState("");

    // ── Edit mode helpers ─────────────────────────────────────────────────────
    const visibleDefs = definitions.filter(
        (d) => d.kindScope === "BOTH" || d.kindScope === editKind
    );

    // ── Edit submit ───────────────────────────────────────────────────────────
    async function onEditSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        let creditLimitCents: string | null = null;
        try {
            const clean = editCreditLimit.trim().replace(/,/g, "");
            creditLimitCents = clean ? toCents(clean).toString() : null;
        } catch {
            setError("Límite de crédito inválido. Use formato numérico (ej: 500.00)");
            return;
        }

        startTransition(async () => {
            try {
                if (!initial) return;
                const res = await updateEntity({
                    id: initial.id,
                    displayName: editName.trim(),
                    documentType: editDocType.trim() || null,
                    documentNumber: editDocNum.trim() || null,
                    primaryEmail: editEmail.trim() || null,
                    primaryPhone: editPhone.trim() || null,
                    creditLimitCents,
                    paymentDueAt: editPaymentDue.trim() || null,
                    isActive: editIsActive,
                    customFields: editCustomFields,
                });
                if (!res.success || !res.data) {
                    setError(res.error || "Error al actualizar");
                    return;
                }
                router.push(`/dashboard/creditos/entities/${initial.id}`);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Error desconocido");
            }
        });
    }

    // ── Wizard final submit ───────────────────────────────────────────────────
    function handleCreate() {
        setError(null);

        if (!wizName.trim() || wizName.trim().length < 2) {
            setError("El nombre es requerido (mínimo 2 caracteres)");
            return;
        }

        let creditLimitCents: string | null = null;
        try {
            const clean = wizCreditLimit.trim().replace(/,/g, "");
            creditLimitCents = clean ? toCents(clean).toString() : null;
        } catch {
            setError("Límite de crédito inválido. Use formato numérico (ej: 500.00)");
            return;
        }

        const references: Array<{ name: string; phone: string; relationship: string }> = [];
        if (wizRef1Name.trim()) {
            references.push({
                name: wizRef1Name.trim(),
                phone: wizRef1Phone.trim(),
                relationship: wizRef1Rel,
            });
        }
        if (wizRef2Name.trim()) {
            references.push({
                name: wizRef2Name.trim(),
                phone: wizRef2Phone.trim(),
                relationship: wizRef2Rel,
            });
        }

        const extendedData = {
            address:
                wizProvince || wizArea || wizStreet
                    ? {
                          province: wizProvince || undefined,
                          area: wizArea.trim() || undefined,
                          street: wizStreet.trim() || undefined,
                      }
                    : undefined,
            employment:
                wizKind === "PERSON" && (wizWorkplace || wizPosition || wizSalaryAmount)
                    ? {
                          workplace: wizWorkplace.trim() || undefined,
                          position: wizPosition.trim() || undefined,
                          salaryAmount: wizSalaryAmount.trim() || undefined,
                          salaryFrequency: wizSalaryFreq,
                      }
                    : undefined,
            creditSettings:
                wizInterestRate || wizPaymentCycle
                    ? {
                          interestRatePercent: wizInterestRate.trim() || undefined,
                          paymentCycleType: wizPaymentCycle,
                          paymentCycleDayOfMonth:
                              wizPaymentCycle === "monthly"
                                  ? parseInt(wizPaymentDay, 10) || undefined
                                  : undefined,
                      }
                    : undefined,
            references: references.length > 0 ? references : undefined,
            guarantor: wizFiadorName.trim()
                ? {
                      name: wizFiadorName.trim(),
                      phone: wizFiadorPhone.trim() || undefined,
                      documentType: wizFiadorDocType || undefined,
                      documentNumber: wizFiadorDocNum.trim() || undefined,
                  }
                : undefined,
        };

        startTransition(async () => {
            try {
                const res = await createEntity({
                    kind: wizKind,
                    displayName: wizName.trim(),
                    documentType: wizDocType || null,
                    documentNumber: wizDocNum.trim() || null,
                    primaryEmail: wizEmail.trim() || null,
                    primaryPhone: wizPhone.trim() || null,
                    creditLimitCents,
                    paymentDueAt: wizPaymentDueDate || null,
                    customFields: wizCustomFields,
                    extendedData,
                });
                if (!res.success || !res.data) {
                    setError(res.error || "Error al crear");
                    return;
                }
                router.push(`/dashboard/creditos/entities/${res.data.id}`);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Error desconocido");
            }
        });
    }

    // ── Step validation ───────────────────────────────────────────────────────
    function canAdvance(): boolean {
        if (step === 1) return wizName.trim().length >= 2;
        return true;
    }

    function advance() {
        if (!canAdvance()) {
            setError("Por favor completa los campos requeridos antes de continuar");
            return;
        }
        setError(null);
        setStep((s) => s + 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT MODE RENDER
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === "edit") {
        return (
            <form onSubmit={onEditSubmit} className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <Field label={editKind === "PERSON" ? "Nombre completo" : "Razón social"} required>
                                <StyledInput
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                />
                            </Field>
                        </div>
                        <Field label="Tipo de documento">
                            <select
                                value={editDocType}
                                onChange={(e) => setEditDocType(e.target.value)}
                                className={selectCls}
                            >
                                <option value="">—</option>
                                {DOC_TYPES.map((d) => (
                                    <option key={d.value} value={d.value}>
                                        {d.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Número de documento">
                            <StyledInput
                                value={editDocNum}
                                onChange={(e) => setEditDocNum(e.target.value)}
                                className="font-mono"
                            />
                        </Field>
                        <Field label="Email">
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <StyledInput
                                    type="email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </Field>
                        <Field label="Teléfono">
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <StyledInput
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </Field>
                        <Field label="Límite de crédito (B/.)">
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <StyledInput
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editCreditLimit}
                                    onChange={(e) => setEditCreditLimit(e.target.value)}
                                    placeholder="0.00 (vacío = sin límite)"
                                    className="pl-9"
                                />
                            </div>
                        </Field>
                        <Field label="Próxima fecha de pago">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <StyledInput
                                    type="date"
                                    value={editPaymentDue}
                                    onChange={(e) => setEditPaymentDue(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </Field>
                        <div className="sm:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editIsActive}
                                    onChange={(e) => setEditIsActive(e.target.checked)}
                                    className="rounded border-border"
                                />
                                <span className="text-sm font-medium text-foreground">Entidad activa</span>
                            </label>
                        </div>
                    </div>

                    {visibleDefs.length > 0 && (
                        <div className="pt-4 border-t border-border space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Campos personalizados
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {visibleDefs.map((def) => (
                                    <DynamicField
                                        key={def.id}
                                        def={def}
                                        value={editCustomFields[def.slug] ?? null}
                                        onChange={(v) =>
                                            setEditCustomFields((prev) => ({ ...prev, [def.slug]: v }))
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {isPending ? (
                            <>
                                <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Guardar cambios
                            </>
                        )}
                    </button>
                </div>
            </form>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE MODE — WIZARD RENDER
    // ─────────────────────────────────────────────────────────────────────────
    const wizDefs = definitions.filter(
        (d) => d.kindScope === "BOTH" || d.kindScope === wizKind
    );

    return (
        <div className="space-y-6 max-w-2xl">
            {/* ── Progress bar ── */}
            <div className="flex items-center gap-1.5">
                {WIZARD_STEPS.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <div
                            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all ${
                                i < step
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : i === step
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground border border-border"
                            }`}
                        >
                            {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <span
                            className={`text-xs font-medium hidden sm:block ${
                                i === step ? "text-foreground" : "text-muted-foreground"
                            }`}
                        >
                            {s.label}
                        </span>
                        {i < WIZARD_STEPS.length - 1 && (
                            <div
                                className={`h-px w-4 sm:w-6 transition-colors ${
                                    i < step ? "bg-emerald-500/40" : "bg-border"
                                }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* ── Step card ── */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">

                {/* ── STEP 0: Tipo ── */}
                {step === 0 && (
                    <>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                ¿Qué tipo de entidad es?
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Selecciona el tipo para continuar
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => { setWizKind("PERSON"); setStep(1); }}
                                className="p-6 rounded-xl border-2 border-border bg-background text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 group"
                            >
                                <User className="w-10 h-10 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                <p className="font-semibold text-foreground">Persona</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Cliente natural, persona física
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setWizKind("COMPANY"); setStep(1); }}
                                className="p-6 rounded-xl border-2 border-border bg-background text-left transition-all hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/40 group"
                            >
                                <Building2 className="w-10 h-10 mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                <p className="font-semibold text-foreground">Empresa</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Persona jurídica, razón social
                                </p>
                            </button>
                        </div>
                    </>
                )}

                {/* ── STEP 1: Información básica ── */}
                {step === 1 && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                {wizKind === "PERSON" ? (
                                    <User className="w-4 h-4 text-primary" />
                                ) : (
                                    <Building2 className="w-4 h-4 text-primary" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">
                                    Información básica
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {wizKind === "PERSON" ? "Persona natural" : "Empresa / Persona jurídica"}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <Field
                                    label={wizKind === "PERSON" ? "Nombre completo" : "Razón social"}
                                    required
                                >
                                    <StyledInput
                                        value={wizName}
                                        onChange={(e) => setWizName(e.target.value)}
                                        placeholder={
                                            wizKind === "PERSON"
                                                ? "Ej: Juan Alberto Pérez López"
                                                : "Ej: Constructora XYZ S.A."
                                        }
                                        autoFocus
                                    />
                                </Field>
                            </div>

                            <div>
                                <Field label="Tipo de documento">
                                    <div className="flex flex-wrap gap-2">
                                        {DOC_TYPES.map((dt) => (
                                            <Pill
                                                key={dt.value}
                                                active={wizDocType === dt.value}
                                                onClick={() => setWizDocType(dt.value)}
                                            >
                                                {dt.label}
                                            </Pill>
                                        ))}
                                    </div>
                                </Field>
                            </div>

                            <div>
                                <Field label="Número de documento">
                                    <StyledInput
                                        value={wizDocNum}
                                        onChange={(e) => setWizDocNum(e.target.value)}
                                        placeholder={
                                            wizDocType === "CEDULA"
                                                ? "8-0000-0000"
                                                : wizDocType === "RUC"
                                                ? "000-000-00000-0"
                                                : ""
                                        }
                                        className="font-mono"
                                    />
                                </Field>
                            </div>

                            <div>
                                <Field label="Email">
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <StyledInput
                                            type="email"
                                            value={wizEmail}
                                            onChange={(e) => setWizEmail(e.target.value)}
                                            placeholder="correo@ejemplo.com"
                                            className="pl-9"
                                        />
                                    </div>
                                </Field>
                            </div>

                            <div>
                                <Field label="Teléfono">
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <StyledInput
                                            value={wizPhone}
                                            onChange={(e) => setWizPhone(e.target.value)}
                                            placeholder="6000-0000"
                                            className="pl-9"
                                        />
                                    </div>
                                </Field>
                            </div>
                        </div>

                        {/* Custom field definitions (if any) */}
                        {wizDefs.length > 0 && (
                            <div className="pt-4 border-t border-border space-y-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Campos adicionales
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {wizDefs.map((def) => (
                                        <DynamicField
                                            key={def.id}
                                            def={def}
                                            value={wizCustomFields[def.slug] ?? null}
                                            onChange={(v) =>
                                                setWizCustomFields((prev) => ({
                                                    ...prev,
                                                    [def.slug]: v,
                                                }))
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── STEP 2: Dirección ── */}
                {step === 2 && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Dirección</h2>
                                <p className="text-xs text-muted-foreground">
                                    Información de ubicación (opcional)
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Field label="Provincia">
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                        <select
                                            value={wizProvince}
                                            onChange={(e) => setWizProvince(e.target.value)}
                                            className={`${selectCls} pl-9`}
                                        >
                                            <option value="">— Seleccionar —</option>
                                            {PANAMA_PROVINCES.map((p) => (
                                                <option key={p} value={p}>
                                                    {p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </Field>
                            </div>

                            <div>
                                <Field label="Corregimiento / Área">
                                    <StyledInput
                                        value={wizArea}
                                        onChange={(e) => setWizArea(e.target.value)}
                                        placeholder="Ej: Juan Díaz"
                                    />
                                </Field>
                            </div>

                            <div className="sm:col-span-2">
                                <Field label="Dirección / Calle">
                                    <div className="relative">
                                        <Home className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                        <textarea
                                            value={wizStreet}
                                            onChange={(e) => setWizStreet(e.target.value)}
                                            rows={2}
                                            placeholder="Ej: Calle 50, Edificio Pacific, Apto 3B"
                                            className={`${inputCls} pl-9 resize-none`}
                                        />
                                    </div>
                                </Field>
                            </div>
                        </div>
                    </>
                )}

                {/* ── STEP 3: Empleo & Crédito ── */}
                {step === 3 && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <CreditCard className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">
                                    Empleo & Crédito
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Información laboral y condiciones crediticias
                                </p>
                            </div>
                        </div>

                        {/* Employment (PERSON only) */}
                        {wizKind === "PERSON" && (
                            <div className="space-y-4">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5" /> Información laboral
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <Field label="Lugar de trabajo">
                                            <StyledInput
                                                value={wizWorkplace}
                                                onChange={(e) => setWizWorkplace(e.target.value)}
                                                placeholder="Ej: Banco Nacional de Panamá"
                                            />
                                        </Field>
                                    </div>
                                    <div>
                                        <Field label="Cargo / Puesto">
                                            <StyledInput
                                                value={wizPosition}
                                                onChange={(e) => setWizPosition(e.target.value)}
                                                placeholder="Ej: Analista de Crédito"
                                            />
                                        </Field>
                                    </div>
                                    <div>
                                        <Field label="Salario (B/.)">
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <StyledInput
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={wizSalaryAmount}
                                                    onChange={(e) => setWizSalaryAmount(e.target.value)}
                                                    placeholder="0.00"
                                                    className="pl-9"
                                                />
                                            </div>
                                        </Field>
                                    </div>
                                    <div>
                                        <Field label="Frecuencia de salario">
                                            <div className="flex gap-2">
                                                {SALARY_FREQUENCIES.map((sf) => (
                                                    <Pill
                                                        key={sf.value}
                                                        active={wizSalaryFreq === sf.value}
                                                        onClick={() => setWizSalaryFreq(sf.value)}
                                                    >
                                                        {sf.label}
                                                    </Pill>
                                                ))}
                                            </div>
                                        </Field>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Credit settings */}
                        <div className="space-y-4 pt-4 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5" /> Condiciones de crédito
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Field label="Límite de crédito (B/.)">
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <StyledInput
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={wizCreditLimit}
                                                onChange={(e) => setWizCreditLimit(e.target.value)}
                                                placeholder="0.00 (vacío = sin límite)"
                                                className="pl-9"
                                            />
                                        </div>
                                    </Field>
                                </div>

                                <div>
                                    <Field label="Tasa de interés mensual (%)">
                                        <div className="relative">
                                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <StyledInput
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={wizInterestRate}
                                                onChange={(e) => setWizInterestRate(e.target.value)}
                                                placeholder="Ej: 2.5"
                                                className="pl-9"
                                            />
                                        </div>
                                    </Field>
                                </div>

                                <div>
                                    <Field label="Ciclo de pago">
                                        <div className="flex gap-2">
                                            {PAYMENT_CYCLES.map((pc) => (
                                                <Pill
                                                    key={pc.value}
                                                    active={wizPaymentCycle === pc.value}
                                                    onClick={() => setWizPaymentCycle(pc.value)}
                                                >
                                                    {pc.label}
                                                </Pill>
                                            ))}
                                        </div>
                                    </Field>
                                </div>

                                {wizPaymentCycle === "monthly" && (
                                    <div>
                                        <Field label="Día del mes de pago (1–28)">
                                            <StyledInput
                                                type="number"
                                                min="1"
                                                max="28"
                                                value={wizPaymentDay}
                                                onChange={(e) => setWizPaymentDay(e.target.value)}
                                                placeholder="15"
                                            />
                                        </Field>
                                    </div>
                                )}

                                <div>
                                    <Field label="Próxima fecha de pago">
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <StyledInput
                                                type="date"
                                                value={wizPaymentDueDate}
                                                onChange={(e) => setWizPaymentDueDate(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── STEP 4: Referencias & Fiador ── */}
                {step === 4 && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">
                                    Referencias & Fiador
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Contactos de referencia y garantía (opcional)
                                </p>
                            </div>
                        </div>

                        {/* Reference 1 */}
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5" /> Referencia personal 1
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <Field label="Nombre">
                                        <StyledInput
                                            value={wizRef1Name}
                                            onChange={(e) => setWizRef1Name(e.target.value)}
                                            placeholder="Nombre completo"
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Teléfono">
                                        <StyledInput
                                            value={wizRef1Phone}
                                            onChange={(e) => setWizRef1Phone(e.target.value)}
                                            placeholder="6000-0000"
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Relación">
                                        <select
                                            value={wizRef1Rel}
                                            onChange={(e) => setWizRef1Rel(e.target.value)}
                                            className={selectCls}
                                        >
                                            {REFERENCE_RELATIONSHIPS.map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* Reference 2 */}
                        <div className="space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5" /> Referencia personal 2
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <Field label="Nombre">
                                        <StyledInput
                                            value={wizRef2Name}
                                            onChange={(e) => setWizRef2Name(e.target.value)}
                                            placeholder="Nombre completo"
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Teléfono">
                                        <StyledInput
                                            value={wizRef2Phone}
                                            onChange={(e) => setWizRef2Phone(e.target.value)}
                                            placeholder="6000-0000"
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Relación">
                                        <select
                                            value={wizRef2Rel}
                                            onChange={(e) => setWizRef2Rel(e.target.value)}
                                            className={selectCls}
                                        >
                                            {REFERENCE_RELATIONSHIPS.map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* Fiador */}
                        <div className="space-y-3 pt-4 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5" /> Fiador
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Field label="Nombre del fiador">
                                        <StyledInput
                                            value={wizFiadorName}
                                            onChange={(e) => setWizFiadorName(e.target.value)}
                                            placeholder="Nombre completo"
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Teléfono">
                                        <StyledInput
                                            value={wizFiadorPhone}
                                            onChange={(e) => setWizFiadorPhone(e.target.value)}
                                            placeholder="6000-0000"
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Tipo de documento">
                                        <div className="flex flex-wrap gap-2">
                                            {DOC_TYPES.map((dt) => (
                                                <Pill
                                                    key={dt.value}
                                                    active={wizFiadorDocType === dt.value}
                                                    onClick={() => setWizFiadorDocType(dt.value)}
                                                >
                                                    {dt.label}
                                                </Pill>
                                            ))}
                                        </div>
                                    </Field>
                                </div>
                                <div>
                                    <Field label="Número de documento">
                                        <StyledInput
                                            value={wizFiadorDocNum}
                                            onChange={(e) => setWizFiadorDocNum(e.target.value)}
                                            placeholder="8-0000-0000"
                                            className="font-mono"
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ── Error display ── */}
                {error && (
                    <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}
            </div>

            {/* ── Navigation ── */}
            <div className="flex items-center justify-between">
                {step > 0 ? (
                    <button
                        type="button"
                        onClick={() => { setError(null); setStep((s) => s - 1); }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-border/80 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground border border-border transition-colors"
                    >
                        Cancelar
                    </button>
                )}

                {/* Step 0 auto-advances on card click — no button needed */}
                {step === 0 && <div />}

                {step > 0 && step < WIZARD_STEPS.length - 1 && (
                    <button
                        type="button"
                        onClick={advance}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Continuar
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}

                {step === WIZARD_STEPS.length - 1 && (
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                        {isPending ? (
                            <>
                                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Crear {wizKind === "PERSON" ? "cliente" : "empresa"}
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── DynamicField (custom field definitions) ─────────────────────────────────

function DynamicField({
    def,
    value,
    onChange,
}: {
    def: FieldDef;
    value: string | number | boolean | null;
    onChange: (v: string | number | boolean | null) => void;
}) {
    const label = (
        <label className="block text-sm font-medium text-foreground mb-1.5">
            {def.label}{" "}
            {def.required && <span className="text-red-400">*</span>}
        </label>
    );

    switch (def.type) {
        case "TEXT":
            return (
                <div>
                    {label}
                    <input
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => onChange(e.target.value)}
                        required={def.required}
                        className={inputCls}
                    />
                </div>
            );
        case "NUMBER":
            return (
                <div>
                    {label}
                    <input
                        type="number"
                        value={typeof value === "number" ? value : ""}
                        onChange={(e) =>
                            onChange(e.target.value === "" ? null : Number(e.target.value))
                        }
                        required={def.required}
                        className={inputCls}
                    />
                </div>
            );
        case "DATE":
            return (
                <div>
                    {label}
                    <input
                        type="date"
                        value={typeof value === "string" ? value.slice(0, 10) : ""}
                        onChange={(e) => onChange(e.target.value || null)}
                        required={def.required}
                        className={inputCls}
                    />
                </div>
            );
        case "BOOLEAN":
            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => onChange(e.target.checked)}
                        className="rounded border-border"
                    />
                    <span className="text-sm font-medium text-foreground">
                        {def.label}{" "}
                        {def.required && <span className="text-red-400">*</span>}
                    </span>
                </label>
            );
        case "SELECT":
            return (
                <div>
                    {label}
                    <select
                        value={typeof value === "string" ? value : ""}
                        onChange={(e) => onChange(e.target.value || null)}
                        required={def.required}
                        className={selectCls}
                    >
                        <option value="">—</option>
                        {def.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            );
    }
}
