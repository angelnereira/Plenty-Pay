/**
 * POST /api/upload/image
 * Server-side image upload.
 *
 * Strategy:
 * 1. Try Cloudinary if configured (CLOUDINARY_URL env var)
 * 2. Fall back to storing optimized base64 directly in the response
 *    (caller stores it in the database)
 *
 * The image is resized server-side to max 480px and compressed to ~30-50KB.
 */

import { auth } from "@core/auth"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

// Optimize image: resize to max 480px, convert to webp, compress
async function optimizeImage(base64: string): Promise<string> {
  // Extract raw data from data URL
  const matches = base64.match(/^data:image\/\w+;base64,(.+)$/)
  if (!matches) throw new Error("Invalid base64 image")

  const buffer = Buffer.from(matches[1], "base64")

  const optimized = await sharp(buffer)
    .resize(480, 480, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer()

  return `data:image/webp;base64,${optimized.toString("base64")}`
}


export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const clientId = session.user.clientId
  if (!clientId) return NextResponse.json({ error: "Sin organización" }, { status: 400 })

  try {
    const body = await request.json()
    const { image } = body as { image: string }

    if (!image || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Imagen requerida en formato base64" }, { status: 400 })
    }

    // Optimize image first (resize + compress)
    let optimized: string
    try {
      optimized = await optimizeImage(image)
    } catch {
      // If sharp fails, use original (might be large)
      optimized = image
    }

    // Simplified strategy: Always use direct storage (optimized base64)
    // Cloudinary logic removed as per user request.

    // Strategy 2: Return optimized base64 for direct DB storage
    // The caller (ImageUpload component) stores it in the product.image field
    return NextResponse.json({
      success: true,
      publicId: optimized, // Store the data URL as the "publicId"
      url: optimized,
      storage: "direct",
    })
  } catch (error) {
    console.error("[UPLOAD] Unexpected error:", error)
    return NextResponse.json({ error: "Error interno al procesar la imagen" }, { status: 500 })
  }
}
