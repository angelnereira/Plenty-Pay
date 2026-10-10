import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prismaServer } from "@core/database/prisma-server";
import { MotorAccessManager } from "@/components/motor/MotorAccessManager";

export const dynamic = "force-dynamic";

export default async function MotorAccessAdminPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");
    if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

    // Lista actual de usuarios con acceso al panel + tenant info
    const granted = await prismaServer.motorUserAccess.findMany({
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    clientId: true,
                },
            },
            client: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ status: "asc" }, { grantedAt: "desc" }],
    });

    const allUsers = await prismaServer.user.findMany({
        select: { id: true, email: true, name: true, client: { select: { slug: true } } },
        orderBy: { email: "asc" },
    });

    return (
        <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Créditos: panel avanzado</h1>
                <p className="text-sm text-muted-foreground">
                    Concede o revoca acceso al panel avanzado del Motor (Schema Builder,
                    intereses por ciclo, ajustes manuales) para usuarios concretos. El
                    Módulo de Créditos visible se controla por tenant con el flag
                    <code className="mx-1 px-1 bg-muted rounded text-xs">creditosEnabled</code>
                    en /admin/clients — esto solo añade funcionalidad avanzada para usuarios
                    seleccionados.
                </p>
            </div>

            <MotorAccessManager
                granted={granted.map((a) => ({
                    id: a.id,
                    userId: a.userId,
                    userName: a.user.name,
                    userEmail: a.user.email,
                    clientId: a.clientId,
                    clientName: a.client.name,
                    clientSlug: a.client.slug,
                    status: a.status,
                    grantedAt: a.grantedAt.toISOString(),
                    revokedAt: a.revokedAt?.toISOString() ?? null,
                    notes: a.notes,
                }))}
                users={allUsers.map((u) => ({
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    clientSlug: u.client?.slug ?? "N/A",
                }))}
            />
        </div>
    );
}
