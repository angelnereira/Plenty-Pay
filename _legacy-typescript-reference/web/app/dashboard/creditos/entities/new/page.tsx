import Link from "next/link";
import { requireCreditAccess } from "@core/motor/access";
import { prismaServer } from "@core/database/prisma-server";
import { EntityForm } from "@/components/motor/EntityForm";

export const dynamic = "force-dynamic";

export default async function NewEntityPage() {
    const { clientId } = await requireCreditAccess();
    const definitions = await prismaServer.motorEntityFieldDefinition.findMany({
        where: { clientId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return (
        <div className="space-y-5 max-w-2xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard/creditos" className="hover:underline">
                    Créditos
                </Link>
                <span>›</span>
                <span>Nueva entidad</span>
            </div>
            <EntityForm
                mode="create"
                definitions={definitions.map((d) => ({
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
