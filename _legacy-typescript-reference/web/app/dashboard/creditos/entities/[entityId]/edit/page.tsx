import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreditAccess } from "@core/motor/access";
import { prismaServer } from "@core/database/prisma-server";
import { EntityForm } from "@/components/motor/EntityForm";
import { serializeMotorEntity } from "@/lib/motor/serialize";

export const dynamic = "force-dynamic";

export default async function EditEntityPage({
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

    const definitions = await (prismaServer as any).motorEntityFieldDefinition.findMany({
        where: { clientId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const serialized = serializeMotorEntity(entity);

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
                <span>Editar</span>
            </div>
            <h1 className="text-2xl font-bold">Editar entidad</h1>
            <EntityForm
                mode="edit"
                initial={{
                    id: entity.id,
                    kind: entity.kind,
                    displayName: entity.displayName,
                    documentType: entity.documentType,
                    documentNumber: entity.documentNumber,
                    primaryEmail: entity.primaryEmail,
                    primaryPhone: entity.primaryPhone,
                    creditLimitCents: serialized.creditLimitCents,
                    paymentDueAt: entity.paymentDueAt
                        ? entity.paymentDueAt.toISOString().slice(0, 10)
                        : null,
                    isActive: entity.isActive,
                    customFields:
                        (entity.customFields as Record<string, string | number | boolean | null> | null) ??
                        null,
                }}
                definitions={definitions.map((d: any) => ({
                    id: d.id,
                    slug: d.slug,
                    label: d.label,
                    type: d.type,
                    required: d.required,
                    options: (d.options as { value: string; label: string }[] | null) ?? null,
                    kindScope: d.kindScope,
                }))}
            />
        </div>
    );
}
