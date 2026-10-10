import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireCreditAccess } from "@core/motor/access";
import { prismaServer } from "@core/database/prisma-server";
import { formatCents } from "@/lib/motor/money";
import { getMotorTierUsage } from "@/lib/motor/pricing";

export const dynamic = "force-dynamic";

interface SearchParams {
    kind?: string;
    q?: string;
}

export default async function CreditosPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const { clientId } = await requireCreditAccess();
    const tierUsage = await getMotorTierUsage(clientId);
    const params = await searchParams;
    const kindFilter = params.kind === "PERSON" || params.kind === "COMPANY" ? params.kind : undefined;
    const q = params.q?.trim() || undefined;

    const entities = await prismaServer.motorEntity.findMany({
        where: {
            clientId,
            deletedAt: null,
            ...(kindFilter ? { kind: kindFilter } : {}),
            ...(q
                ? {
                      OR: [
                          { displayName: { contains: q, mode: "insensitive" } },
                          { documentNumber: { contains: q } },
                          { primaryEmail: { contains: q, mode: "insensitive" } },
                      ],
                  }
                : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    // Saldo actual por entidad: último runningBalanceCents
    const entityIds = entities.map((e) => e.id);
    const balanceByEntity = new Map<string, bigint>();
    if (entityIds.length > 0) {
        const rows = await prismaServer.$queryRaw<
            { entityId: string; runningBalanceCents: bigint }[]
        >(Prisma.sql`
            SELECT DISTINCT ON ("entityId") "entityId", "runningBalanceCents"
            FROM "motor_ledger_entries"
            WHERE "clientId" = ${clientId}
              AND "entityId" IN (${Prisma.join(entityIds)})
            ORDER BY "entityId", "createdAt" DESC
        `);
        for (const row of rows) {
            balanceByEntity.set(row.entityId, row.runningBalanceCents);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Módulo de Créditos</h1>
                    <p className="text-sm text-muted-foreground">
                        Gestiona el crédito otorgado a tus clientes y proveedores: cargos por factura
                        a crédito, abonos, ajustes y estado de cuenta.
                    </p>
                    {tierUsage && (
                        <div
                            className={`mt-2 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${
                                tierUsage.nearLimit
                                    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                    : "border-muted bg-muted/40 text-muted-foreground"
                            }`}
                            title={`${tierUsage.label} · ${tierUsage.priceLabel}`}
                        >
                            <span className="font-medium">
                                Tier {tierUsage.tier.replace("TIER_", "")}
                            </span>
                            <span aria-hidden>·</span>
                            <span>
                                {tierUsage.used} / {tierUsage.limit} clientes con crédito
                            </span>
                            {tierUsage.nearLimit && (
                                <span className="ml-1 font-semibold">— cerca del límite</span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/dashboard/creditos/schema"
                        className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
                    >
                        Schema Builder
                    </Link>
                    <Link
                        href="/dashboard/creditos/entities/new"
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
                    >
                        Nueva entidad
                    </Link>
                </div>
            </div>

            <form className="flex flex-wrap gap-2 items-end" method="get">
                <input
                    type="search"
                    name="q"
                    defaultValue={q ?? ""}
                    placeholder="Buscar por nombre, documento o email"
                    className="border rounded-md px-3 py-2 text-sm flex-1 min-w-[200px]"
                />
                <select
                    name="kind"
                    defaultValue={kindFilter ?? ""}
                    className="border rounded-md px-3 py-2 text-sm"
                >
                    <option value="">Todos los tipos</option>
                    <option value="PERSON">Personas</option>
                    <option value="COMPANY">Empresas</option>
                </select>
                <button
                    type="submit"
                    className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
                >
                    Filtrar
                </button>
            </form>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2 font-medium">Nombre</th>
                            <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Tipo</th>
                            <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Documento</th>
                            <th className="text-right px-4 py-2 font-medium">Saldo</th>
                            <th className="text-center px-4 py-2 font-medium">Acciones rápidas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entities.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No hay entidades. Crea la primera con &ldquo;Nueva entidad&rdquo;.
                                </td>
                            </tr>
                        )}
                        {entities.map((e) => {
                            const balance = balanceByEntity.get(e.id) ?? 0n;
                            return (
                                <tr key={e.id} className="border-t hover:bg-muted/30">
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/dashboard/creditos/entities/${e.id}`}
                                            className="text-primary hover:underline font-medium text-sm"
                                        >
                                            {e.displayName}
                                        </Link>
                                        <p className="text-xs text-muted-foreground sm:hidden">
                                            {e.kind === "PERSON" ? "Persona" : "Empresa"}
                                            {e.documentNumber && ` · ${e.documentNumber}`}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-sm hidden sm:table-cell">
                                        {e.kind === "PERSON" ? "Persona" : "Empresa"}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">
                                        {e.documentNumber ?? "—"}
                                    </td>
                                    <td
                                        className={`px-4 py-3 text-right font-mono text-sm ${
                                            balance < 0n
                                                ? "text-red-500"
                                                : balance > 0n
                                                ? "text-emerald-500"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        {formatCents(balance, { withCurrency: true })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Link
                                                href={`/dashboard/creditos/entities/${e.id}?mt=PAYMENT`}
                                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                            >
                                                Abonar
                                            </Link>
                                            <Link
                                                href={`/dashboard/creditos/entities/${e.id}?mt=CHARGE`}
                                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                            >
                                                Cobrar
                                            </Link>
                                            <Link
                                                href={`/dashboard/creditos/entities/${e.id}`}
                                                className="px-2.5 py-1 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                            >
                                                Ver
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
