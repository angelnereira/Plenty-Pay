"use client";

/**
 * Barra de acciones de crédito + modal unificado de 3 fases.
 *
 * Reemplaza a CreditPanel y MovementForm. Toda operación que escribe al
 * ledger (Otorgar crédito, Registrar pago, Aplicar interés, Ajustes) pasa
 * por el mismo flujo:
 *
 *   1) input    — captura monto y descripción
 *   2) preview  — muestra "saldo pasará de X a Y" antes de confirmar
 *   3) confirm  — ejecuta la server action
 *
 * El backend determina el tipo real (CHARGE / PAYMENT / ADJUSTMENT_*).
 */

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, ArrowDownToLine, Percent, MoreHorizontal,
    AlertCircle, CheckCircle2, ArrowLeft, X, RefreshCw,
    TrendingUp, TrendingDown,
} from "lucide-react";
import { formatCents, toCents } from "@/lib/motor/money";
import {
    registerPayment,
    registerAdjustment,
} from "@/actions/motor/ledger";
import { applyInterest, grantCredit } from "@/actions/motor/interest";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ActionKind = "GRANT" | "PAYMENT" | "INTEREST" | "ADJUST_DECREASE" | "ADJUST_INCREASE";

interface ActionSpec {
    label: string;
    title: string;
    helpText: string;
    /** Cómo afecta el saldo: aumenta deuda (negativo) o reduce deuda (positivo). */
    delta: "DEBT_UP" | "DEBT_DOWN";
    /** Descripción obligatoria (min 3 chars). */
    requireDescription: boolean;
    descriptionPlaceholder: string;
    descriptionDefault?: string;
    confirmLabel: string;
    /** Color de la acción (verde = a favor, naranja = en contra, etc.). */
    tone: "primary" | "success" | "warning" | "danger";
}

const SPECS: Record<ActionKind, ActionSpec> = {
    GRANT: {
        label: "Otorgar crédito",
        title: "Otorgar crédito al cliente",
        helpText: "Registra un crédito otorgado. Aumenta la deuda del cliente.",
        delta: "DEBT_UP",
        requireDescription: false,
        descriptionPlaceholder: "Ej: Crédito de temporada",
        descriptionDefault: "Crédito otorgado",
        confirmLabel: "Confirmar y otorgar crédito",
        tone: "primary",
    },
    PAYMENT: {
        label: "Registrar pago",
        title: "Registrar pago del cliente",
        helpText: "Registra un abono. Reduce la deuda del cliente.",
        delta: "DEBT_DOWN",
        requireDescription: false,
        descriptionPlaceholder: "Ej: Pago en efectivo, transferencia, etc.",
        descriptionDefault: "Pago recibido",
        confirmLabel: "Confirmar y registrar pago",
        tone: "success",
    },
    INTEREST: {
        label: "Aplicar interés",
        title: "Aplicar interés al saldo deudor",
        helpText:
            "Calcula el interés según la tasa y ciclo configurados, y lo registra como cargo en el ledger.",
        delta: "DEBT_UP",
        requireDescription: false,
        descriptionPlaceholder: "",
        confirmLabel: "Confirmar y aplicar interés",
        tone: "warning",
    },
    ADJUST_DECREASE: {
        label: "Reducir deuda (a favor del cliente)",
        title: "Ajuste a favor del cliente",
        helpText:
            "Reduce la deuda manualmente. Úsalo para correcciones, perdones o errores históricos. Queda asentado en el estado de cuenta.",
        delta: "DEBT_DOWN",
        requireDescription: true,
        descriptionPlaceholder: "Razón del ajuste (obligatorio, mínimo 3 caracteres)",
        confirmLabel: "Confirmar ajuste a favor",
        tone: "success",
    },
    ADJUST_INCREASE: {
        label: "Aumentar deuda (en contra del cliente)",
        title: "Ajuste en contra del cliente",
        helpText:
            "Aumenta la deuda manualmente. Úsalo para correcciones de errores históricos. Queda asentado en el estado de cuenta.",
        delta: "DEBT_UP",
        requireDescription: true,
        descriptionPlaceholder: "Razón del ajuste (obligatorio, mínimo 3 caracteres)",
        confirmLabel: "Confirmar ajuste en contra",
        tone: "danger",
    },
};

const TONE_CLASSES: Record<ActionSpec["tone"], string> = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white",
    warning: "bg-orange-600 hover:bg-orange-500 text-white",
    danger:  "bg-red-600 hover:bg-red-500 text-white",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreditActionsProps {
    entityId: string;
    balanceCents: bigint;
    interestPreviewCents: bigint;
    canApplyInterest: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRef(prefix: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${prefix}-${date}-${rand}`;
}

function refPrefixFor(kind: ActionKind): string {
    switch (kind) {
        case "GRANT": return "CRED";
        case "PAYMENT": return "PAY";
        case "INTEREST": return "INT";
        case "ADJUST_DECREASE":
        case "ADJUST_INCREASE":
            return "ADJ";
    }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CreditActions({
    entityId,
    balanceCents,
    interestPreviewCents,
    canApplyInterest,
}: CreditActionsProps) {
    const [openKind, setOpenKind] = useState<ActionKind | null>(null);
    const [adjustMenuOpen, setAdjustMenuOpen] = useState(false);

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                    icon={<Plus className="w-4 h-4" />}
                    label={SPECS.GRANT.label}
                    onClick={() => setOpenKind("GRANT")}
                    tone="primary"
                />
                <ActionButton
                    icon={<ArrowDownToLine className="w-4 h-4" />}
                    label={SPECS.PAYMENT.label}
                    onClick={() => setOpenKind("PAYMENT")}
                    tone="success"
                />
                <ActionButton
                    icon={<Percent className="w-4 h-4" />}
                    label={
                        canApplyInterest && interestPreviewCents > 0n
                            ? `Aplicar interés · ${formatCents(interestPreviewCents, { withCurrency: true })}`
                            : "Aplicar interés"
                    }
                    onClick={() => setOpenKind("INTEREST")}
                    disabled={!canApplyInterest || interestPreviewCents <= 0n}
                    tone="warning"
                    title={
                        !canApplyInterest
                            ? "Configura tasa de interés y ciclo desde Editar"
                            : interestPreviewCents <= 0n
                              ? "No hay saldo deudor sobre el cual aplicar interés"
                              : undefined
                    }
                />

                {/* Ajuste con sub-menú */}
                <div className="relative">
                    <ActionButton
                        icon={<MoreHorizontal className="w-4 h-4" />}
                        label="Ajuste"
                        onClick={() => setAdjustMenuOpen((v) => !v)}
                        tone="ghost"
                    />
                    {adjustMenuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-30"
                                onClick={() => setAdjustMenuOpen(false)}
                            />
                            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-border bg-card shadow-xl z-40 overflow-hidden">
                                <button
                                    onClick={() => {
                                        setAdjustMenuOpen(false);
                                        setOpenKind("ADJUST_DECREASE");
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-start gap-3 border-b border-border"
                                >
                                    <TrendingDown className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Reducir deuda</p>
                                        <p className="text-xs text-muted-foreground">
                                            A favor del cliente · perdón, corrección
                                        </p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        setAdjustMenuOpen(false);
                                        setOpenKind("ADJUST_INCREASE");
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-start gap-3"
                                >
                                    <TrendingUp className="w-4 h-4 mt-0.5 text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">Aumentar deuda</p>
                                        <p className="text-xs text-muted-foreground">
                                            En contra del cliente · corrección de error
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {openKind && (
                <ActionModal
                    kind={openKind}
                    entityId={entityId}
                    balanceCents={balanceCents}
                    interestPreviewCents={interestPreviewCents}
                    onClose={() => setOpenKind(null)}
                />
            )}
        </>
    );
}

// ─── Action Button ────────────────────────────────────────────────────────────

interface ActionButtonProps {
    icon: ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone: "primary" | "success" | "warning" | "danger" | "ghost";
    title?: string;
}

function ActionButton({ icon, label, onClick, disabled, tone, title }: ActionButtonProps) {
    const cls = tone === "ghost"
        ? "border border-border bg-card hover:bg-muted/50 text-foreground"
        : TONE_CLASSES[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
        >
            {icon}
            {label}
        </button>
    );
}

// ─── Modal de 3 fases ─────────────────────────────────────────────────────────

type Phase = "input" | "preview" | "submitting" | "done";

interface ActionModalProps {
    kind: ActionKind;
    entityId: string;
    balanceCents: bigint;
    interestPreviewCents: bigint;
    onClose: () => void;
}

function ActionModal({
    kind,
    entityId,
    balanceCents,
    interestPreviewCents,
    onClose,
}: ActionModalProps) {
    const router = useRouter();
    const spec = SPECS[kind];
    const [phase, setPhase] = useState<Phase>("input");
    const [, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Inputs
    const isInterest = kind === "INTEREST";
    const [amountStr, setAmountStr] = useState(
        isInterest ? formatCents(interestPreviewCents) : ""
    );
    const [description, setDescription] = useState(spec.descriptionDefault ?? "");
    const [reference] = useState(() => generateRef(refPrefixFor(kind)));

    // ── Fase 1 → 2: validar y pasar a preview ────────────────────────────────
    function goToPreview() {
        setError(null);

        if (!isInterest) {
            const trimmed = amountStr.trim().replace(/,/g, "");
            if (!trimmed) {
                setError("Ingresa un monto");
                return;
            }
            try {
                const cents = toCents(trimmed);
                if (cents <= 0n) {
                    setError("El monto debe ser mayor a cero");
                    return;
                }
            } catch {
                setError("Monto inválido. Use formato numérico (ej: 500.00)");
                return;
            }
        }

        if (spec.requireDescription) {
            if (description.trim().length < 3) {
                setError("La descripción es obligatoria (mínimo 3 caracteres)");
                return;
            }
        }

        setPhase("preview");
    }

    // ── Fase 2 → 3: ejecutar ────────────────────────────────────────────────
    function confirm() {
        setError(null);
        setPhase("submitting");

        startTransition(async () => {
            try {
                const desc = description.trim() || spec.descriptionDefault || undefined;
                let res;
                if (kind === "GRANT") {
                    const amountCents = toCents(amountStr.trim().replace(/,/g, "")).toString();
                    res = await grantCredit({ entityId, amountCents, description: desc, reference });
                } else if (kind === "PAYMENT") {
                    const amountCents = toCents(amountStr.trim().replace(/,/g, "")).toString();
                    res = await registerPayment({ entityId, amountCents, description: desc, reference });
                } else if (kind === "INTEREST") {
                    res = await applyInterest({ entityId });
                } else {
                    const amountCents = toCents(amountStr.trim().replace(/,/g, "")).toString();
                    res = await registerAdjustment({
                        entityId,
                        sign: kind === "ADJUST_DECREASE" ? "CREDIT" : "DEBIT",
                        amountCents,
                        description: desc ?? "",
                        reference,
                    });
                }

                if (!res.success) {
                    setError(res.error ?? "Error al ejecutar la operación");
                    setPhase("preview");
                    return;
                }
                setPhase("done");
                router.refresh();
                setTimeout(onClose, 1200);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Error desconocido");
                setPhase("preview");
            }
        });
    }

    // ── Cálculo de delta para preview ────────────────────────────────────────
    const amountCents = (() => {
        if (isInterest) return interestPreviewCents;
        try {
            return toCents(amountStr.trim().replace(/,/g, ""));
        } catch {
            return 0n;
        }
    })();
    const newBalanceCents = spec.delta === "DEBT_UP"
        ? balanceCents - amountCents
        : balanceCents + amountCents;

    const submitting = phase === "submitting";
    const done = phase === "done";

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

                <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border">
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {phase === "preview" && (
                                <button
                                    onClick={() => setPhase("input")}
                                    className="p-1 hover:bg-muted/50 rounded-md transition-colors"
                                    aria-label="Volver"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                            )}
                            <h2 className="font-semibold">{spec.title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="p-1 hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50"
                            aria-label="Cerrar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                        {phase === "input" && (
                            <>
                                <p className="text-sm text-muted-foreground">{spec.helpText}</p>

                                {!isInterest && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Monto (B/.) <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={amountStr}
                                            onChange={(e) => setAmountStr(e.target.value)}
                                            placeholder="0.00"
                                            autoFocus
                                            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                                        />
                                    </div>
                                )}

                                {isInterest && (
                                    <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-sm">
                                        Interés calculado:{" "}
                                        <strong>
                                            {formatCents(interestPreviewCents, { withCurrency: true })}
                                        </strong>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Se calcula sobre el saldo deudor con la tasa configurada.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1.5">
                                        Descripción
                                        {spec.requireDescription && (
                                            <span className="text-red-400 ml-0.5">*</span>
                                        )}
                                        {!spec.requireDescription && (
                                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                                (opcional)
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={spec.descriptionPlaceholder}
                                        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                                    />
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Referencia: <code className="font-mono">{reference}</code>
                                </p>

                                {error && <ErrorBanner message={error} />}

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-3.5 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={goToPreview}
                                        className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${TONE_CLASSES[spec.tone]}`}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </>
                        )}

                        {(phase === "preview" || phase === "submitting") && (
                            <>
                                <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Saldo actual</span>
                                        <span className={`font-mono font-semibold ${balanceCents < 0n ? "text-red-500" : balanceCents > 0n ? "text-emerald-500" : ""}`}>
                                            {formatCents(balanceCents, { withCurrency: true })}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            {spec.delta === "DEBT_UP" ? "Aumenta deuda en" : "Reduce deuda en"}
                                        </span>
                                        <span className={`font-mono font-semibold ${spec.delta === "DEBT_UP" ? "text-red-500" : "text-emerald-500"}`}>
                                            {spec.delta === "DEBT_UP" ? "−" : "+"}
                                            {formatCents(amountCents, { withCurrency: true })}
                                        </span>
                                    </div>
                                    <div className="border-t border-border pt-3 flex items-center justify-between">
                                        <span className="text-sm font-medium">Saldo después</span>
                                        <span className={`font-mono font-bold text-base ${newBalanceCents < 0n ? "text-red-500" : newBalanceCents > 0n ? "text-emerald-500" : ""}`}>
                                            {formatCents(newBalanceCents, { withCurrency: true })}
                                        </span>
                                    </div>
                                </div>

                                {description.trim() && (
                                    <p className="text-xs text-muted-foreground">
                                        Descripción: <span className="text-foreground">{description.trim()}</span>
                                    </p>
                                )}

                                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>
                                        Esta operación queda asentada en el estado de cuenta y no
                                        puede deshacerse. Para corregir, deberás registrar otro
                                        movimiento.
                                    </span>
                                </div>

                                {error && <ErrorBanner message={error} />}

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setPhase("input")}
                                        disabled={submitting}
                                        className="px-3.5 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                                    >
                                        Volver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirm}
                                        disabled={submitting}
                                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${TONE_CLASSES[spec.tone]}`}
                                    >
                                        {submitting ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                {spec.confirmLabel}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}

                        {done && (
                            <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-medium">Operación registrada exitosamente</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-500">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{message}</span>
        </div>
    );
}
