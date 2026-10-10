import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { NextResponse } from "next/server"

/**
 * GET /api/notifications
 * Obtiene las notificaciones del usuario actual
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unreadOnly") === "true"
    const limit = parseInt(searchParams.get("limit") || "20")

    const userId = session.user.id

    // Obtener notificaciones
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    // Contar no leídas
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    })
  } catch (error) {
    console.error("[API] Error al obtener notificaciones:", error)
    return NextResponse.json(
      { error: "Error al obtener notificaciones" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 * Crea una nueva notificación
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const userId = session.user.id

    const body = await request.json()
    const { type, title, message, link } = body

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: type, title, message" },
        { status: 400 }
      )
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        read: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: notification,
    })
  } catch (error) {
    console.error("[API] Error al crear notificación:", error)
    return NextResponse.json(
      { error: "Error al crear notificación" },
      { status: 500 }
    )
  }
}

