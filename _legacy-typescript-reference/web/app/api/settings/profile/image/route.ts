import { auth } from "@core/auth"
import { NextRequest, NextResponse } from "next/server"
import { prismaServer as prisma } from "@core/database"
import sharp from "sharp"

/**
 * POST /api/settings/profile/image
 * Upload and optimize a profile image/logo.
 * Stored as optimized base64 WebP in the User.image field.
 * Max input: 2MB. Output: ~30-80KB WebP.
 */

async function optimizeProfileImage(base64: string): Promise<string> {
  const matches = base64.match(/^data:image\/\w+;base64,(.+)$/)
  if (!matches) throw new Error("Formato de imagen inválido")

  const buffer = Buffer.from(matches[1], "base64")

  // Limit input size: 2MB
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error("La imagen no puede superar 2MB")
  }

  const optimized = await sharp(buffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return `data:image/webp;base64,${optimized.toString("base64")}`
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { image } = body as { image: string | null }

    // Allow removing the image
    if (image === null) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { image: null },
      })
      return NextResponse.json({ success: true, image: null })
    }

    if (!image || !image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Imagen requerida en formato base64 (data:image/...)" },
        { status: 400 }
      )
    }

    const optimized = await optimizeProfileImage(image)

    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: optimized },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email ?? undefined,
        action: "PROFILE_IMAGE_UPDATED",
        entity: "User",
        entityId: session.user.id,
        ip: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    })

    return NextResponse.json({ success: true, image: optimized })
  } catch (error) {
    console.error("[API] Error uploading profile image:", error)
    const message = error instanceof Error ? error.message : "Error al procesar la imagen"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
