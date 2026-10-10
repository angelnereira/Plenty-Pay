import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreditAccess } from "@core/motor/access";
import { prismaServer } from "@core/database/prisma-server";
import { formatCents } from "@/lib/motor/money";
import { CreditActions } from "@/components/motor/CreditActions";
import type { MotorMovementType } from "@prisma/client";
import { Pencil, Award } from "lucide-react";

export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<MotorMovementType, string> = {
    CHARGE: "Cargo",
    PAYMENT: "Abono",
    ADJUSTMENT_CREDIT: "Ajuste +",
    ADJUSTMENT_DEBIT: "Ajuste −",
    LOYALTY_GRANT: "Lealtad +",
    LOYALTY_REDEEM: "Lealtad −",
};

const cycleLabel: Record<string, string> = {
    monthly: "mensual",
    biweekly: "quincenal",
    weekly: "semanal",
};

/** Interés a aplicar: tasa% × deuda. 0 si no hay deuda o no hay tasa. */
function computeInterestPreview(balanceCents: bigint, ratePercent: string | undefined): bigint {
    if (!ratePercent || balanceCents >= 0n) return 0n;
    const rate = parseFloat(ratePercent);
    if (!Number.isFinite(rate) || rate <= 0) return 0n;
    const debt = -balanceCents;
    const rateX1000 = BigInt(Math.round(rate * 1000));
    return (debt * rateX1000 + 50000n) / 100000n;
}

export default async function EntityDetailPage({
    params,
}: {
    params: Promise<{ entityId: string }>;
}) {
    const { clientId } = await requireCreditAccess();
    const { entityId } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity = await (prismaServer as any).motorEntity.findFirst({
        where: { id: entityId, clientId, deletedAt: null },
    });
    if (!entity) notFound();

    const [entries, lastEntry] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prismaServer as any).motorLedgerEntry.findMany({
            where: { clientId, entityId },
            orderBy: { createdAt: "desc" },
            take: 100,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prismaServer as any).motorLedgerEntry.findFirst({
            where: { clientId, entityId },
            orderBy: { createdAt: "desc" },
            select: { runningBalanceCents: true },
        }),
    ]);

    const balance: bigint = lastEntry?.runningBalanceCents ?? 0n;
    const customFields = (entity.customFields ?? {}) as Record<string, unknown>;
    const extData = (customFields._ext ?? {}) as Record<string, unknown>;
    const creditSettings = (extData.creditSettings ?? {}) as Record<string, unknown>;

    const ratePercent = creditSettings.interestRatePercent as string | undefined;
    const cycle = creditSettings.paymentCycleType as string | undefined;
    const interestPreview = computeInterestPreview(balance, ratePercent);
    const hasRate = !!(ratePercent && parseFloat(ratePercent) > 0);

    const isDebt = balance < 0n;
    const limit: bigint | null = entity.creditLimitCents ?? null;
    const available = limit !== null && balance < 0n ? limit + balance : limit;
    const dueAt: Date | null = entity.paymentDueAt ?? null;
    const isOverdue = dueAt && dueAt < new Date() && isDebt;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard/creditos" className="hover:underline">
                    Créditos
                </Link>
                <span>›</span>
                <span>{entity.displayName}</span>
            </div>

            {/* Header con identidad + accesos */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold">{entity.displayName}</h1>
                    <p className="text-sm text-muted-foreground">
                        {entity.kind === "PERSON" ? "Persona" : "Empresa"}
                        {entity.documentNumber && ` · ${entity.documentNumber}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href={`/dashboard/creditos/entities/${entity.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                        Editar
                    </Link>
                    <Link
                        href={`/dashboard/creditos/loyalty/${entity.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors"
                    >
                        <Award className="w-4 h-4" />
                        Lealtad
                    </Link>
                </div>
            </div>

            {/* Hero: saldo + meta-info en un solo bloque */}
            <section
                className={`rounded-2xl border p-6 ${
                    isOverdue
                        ? "border-red-500/40 bg-red-500/5"
                        : isDebt
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border bg-card"
                }`}
            >
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Saldo actual
                        </p>
                        <p
                            className={`text-4xl font-bold tracking-tight ${
                                balance < 0n
                                    ? "text-red-500"
                                    : balance > 0n
                                      ? "text-emerald-500"
                                      : ""
                            }`}
                        >
                            {formatCents(balance, { withCurrency: true })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {balance < 0n
                                ? "Adeuda al tenant"
                                : balance > 0n
                                  ? "Saldo a favor del cliente"
                                  : "Sin saldo"}
                        </p>
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                        <div>
                            <dt className="text-xs text-muted-foreground">Límite</dt>
                            <dd className="font-medium">
                                {limit !== null
                                    ? formatCents(limit, { withCurrency: true })
                                    : "Sin límite"}
                            </dd>
                        </div>
                        {available !== null && (
                            <div>
                                <dt className="text-xs text-muted-foreground">Disponible</dt>
                                <dd className="font-medium">
                                    {formatCents(available, { withCurrency: true })}
                                </dd>
                            </div>
                        )}
                        <div>
                            <dt className="text-xs text-muted-foreground">Próximo pago</dt>
                            <dd className={`font-medium ${isOverdue ? "text-red-500" : ""}`}>
                                {dueAt ? dueAt.toISOString().slice(0, 10) : "—"}
                                {isOverdue && (
                                    <span className="ml-1.5 text-xs font-bold uppercase">
                                        vencido
                                    </span>
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Tasa de interés</dt>
                            <dd className="font-medium">
                                {hasRate
                                    ? `${ratePercent}% ${cycleLabel[cycle ?? "monthly"] ?? ""}`
                                    : "Sin configurar"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs text-muted-foreground">Lealtad</dt>
                            <dd className="font-medium">
                                {formatCents(entity.loyaltyPointsCents, { withCurrency: true })}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Toolbar de acciones */}
                <div className="mt-6 pt-5 border-t border-border">
                    <CreditActions
                        entityId={entity.id}
                        balanceCents={balance}
                        interestPreviewCents={interestPreview}
                        canApplyInterest={hasRate}
                    />
                </div>
            </section>

            {/* Estado de cuenta — protagonista, justo después del hero */}
            <section className="space-y-3">
                <h2 className="font-semibold">Estado de cuenta</h2>
                <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-3 py-2">Fecha</th>
                                <th className="text-left px-3 py-2">Tipo</th>
                                <th className="text-left px-3 py-2">Referencia</th>
                                <th className="text-right px-3 py-2">Monto</th>
                                <th className="text-right px-3 py-2">Saldo</th>
                                <th className="text-center px-3 py-2">Recibo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="text-center py-8 text-muted-foreground"
                                    >
                                        Sin movimientos registrados. Usa los botones de arriba
                                        para registrar el primero.
                                    </td>
                                </tr>
                            )}
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {entries.map((entry: any) => (
                                <tr key={entry.id} className="border-t border-border">
                                    <td className="px-3 py-2 font-mono text-xs">
                                        {entry.createdAt
                                            .toISOString()
                                            .slice(0, 16)
                                            .replace("T", " ")}
                                    </td>
                                    <td className="px-3 py-2">
                                        {MOVEMENT_LABEL[entry.movementType as MotorMovementType]}
                                        {entry.compensatesEntryId && (
                                            <span className="ml-1 text-xs text-muted-foreground">
                                                (reverso)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {entry.reference ?? "—"}
                                        {entry.description && (
                                            <div className="text-xs">{entry.description}</div>
                                        )}
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right font-mono ${
                                            entry.sign === "POSITIVE"
                                                ? "text-emerald-500"
                                                : "text-red-500"
                                        }`}
                                    >
                                        {entry.sign === "POSITIVE" ? "+" : "−"}
                                        {formatCents(entry.amountCents)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">
                                        {formatCents(entry.runningBalanceCents)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <Link
                                            href={`/api/motor/receipts/${entry.id}/pdf`}
                                            className="text-primary hover:underline text-xs"
                                            target="_blank"
                                        >
                                            PDF
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
