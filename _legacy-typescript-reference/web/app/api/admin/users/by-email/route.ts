/**
 * POST /api/admin/users/by-email
 * Resuelve userId desde email. Solo SUPER_ADMIN.
 * Usado por la UI de gestión de acceso al panel del Motor.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@core/auth";
import { prismaServer } from "@core/database/prisma-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
        return NextResponse.json({ error: "email requerido" }, { status: 400 });
    }

    const user = await prismaServer.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, clientId: true, isActive: true },
    });
    if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json(user);
}
