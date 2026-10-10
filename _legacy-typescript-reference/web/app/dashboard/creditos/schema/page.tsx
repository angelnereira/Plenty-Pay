import Link from "next/link";
import { requireCreditAccess } from "@core/motor/access";
import { prismaServer } from "@core/database/prisma-server";
import { SchemaBuilder } from "@/components/motor/SchemaBuilder";

export const dynamic = "force-dynamic";

export default async function SchemaPage() {
    const { clientId } = await requireCreditAccess();
    const definitions = await (prismaServer as any).motorEntityFieldDefinition.findMany({
        where: { clientId },
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard/creditos" className="hover:underline">
                    Créditos
                </Link>
                <span>›</span>
                <span>Schema Builder</span>
            </div>
            <div>
                <h1 className="text-2xl font-bold">Schema Builder</h1>
                <p className="text-sm text-muted-foreground">
                    Define los campos personalizados disponibles para tus entidades.
                </p>
            </div>
            <SchemaBuilder
                initial={definitions.map((d: any) => ({
                    id: d.id,
                    slug: d.slug,
                    label: d.label,
                    type: d.type,
                    required: d.required,
                    options: (d.options as { value: string; label: string }[] | null) ?? null,
                    kindScope: d.kindScope,
                    isActive: d.isActive,
                    sortOrder: d.sortOrder,
                    notes: d.notes,
                }))}
            />
        </div>
    );
}
