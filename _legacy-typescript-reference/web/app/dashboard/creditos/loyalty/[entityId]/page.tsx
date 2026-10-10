import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreditAccess } from "@core/motor/access";
import { prismaServer } from "@core/database/prisma-server";
import { formatCents } from "@/lib/motor/money";
import { LoyaltyForm } from "@/components/motor/LoyaltyForm";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage({
    params,
}: {
    params: Promise<{ entityId: string }>;
}) {
    const { clientId } = await requireCreditAccess();
    const { entityId } = await params;

    const entity = await (prismaServer as any).motorEntity.findFirst({
        where: { id: entityId, clientId, deletedAt: null },
    });
    if (!entity) notFound();

    const recentLoyaltyEntries = await (prismaServer as any).motorLedgerEntry.findMany({
        where: {
            clientId,
            entityId,
            movementType: { in: ["LOYALTY_GRANT", "LOYALTY_REDEEM"] },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
    });

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard/creditos" className="hover:underline">
                    Créditos
                </Link>
                <span>›</span>
                <Link
                    href={`/dashboard/creditos/entities/${entity.id}`}
                    className="hover:underline"
                >
                    {entity.displayName}
                </Link>
                <span>›</span>
                <span>Lealtad</span>
            </div>

            <div>
                <h1 className="text-2xl font-bold">Lealtad y créditos</h1>
                <p className="text-sm text-muted-foreground">{entity.displayName}</p>
            </div>

            <div className="border rounded-lg p-4">
                <p className="text-xs uppercase text-muted-foreground">Saldo de puntos</p>
                <p className="text-3xl font-bold">
                    {formatCents(entity.loyaltyPointsCents, { withCurrency: true })}
                </p>
            </div>

            <LoyaltyForm
                entityId={entity.id}
                availablePointsCents={entity.loyaltyPointsCents.toString()}
            />

            <section className="space-y-2">
                <h2 className="font-semibold">Historial de lealtad</h2>
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left px-3 py-2">Fecha</th>
                                <th className="text-left px-3 py-2">Movimiento</th>
                                <th className="text-left px-3 py-2">Descripción</th>
                                <th className="text-right px-3 py-2">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentLoyaltyEntries.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="text-center py-6 text-muted-foreground"
                                    >
                                        Sin movimientos de lealtad
                                    </td>
                                </tr>
                            )}
                            {recentLoyaltyEntries.map((e: any) => (
                                <tr key={e.id} className="border-t">
                                    <td className="px-3 py-2 font-mono text-xs">
                                        {e.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                                    </td>
                                    <td className="px-3 py-2">
                                        {e.movementType === "LOYALTY_GRANT"
                                            ? "Otorgado"
                                            : "Redimido"}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {e.description ?? "—"}
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right font-mono ${
                                            e.movementType === "LOYALTY_GRANT"
                                                ? "text-green-600"
                                                : "text-red-600"
                                        }`}
                                    >
                                        {e.movementType === "LOYALTY_GRANT" ? "+" : "−"}
                                        {formatCents(e.amountCents)}
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
