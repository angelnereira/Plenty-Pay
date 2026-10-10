import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"

export async function GET() {
  try {
    const session = await auth()

    // Solo super-admins pueden buscar usuarios para el CRM
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: {
        role: "CLIENT",
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        client: {
          select: {
            name: true,
            planType: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("[CRM_USERS_GET_ERROR]", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
