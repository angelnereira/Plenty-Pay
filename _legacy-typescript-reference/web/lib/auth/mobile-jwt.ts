import { SignJWT, jwtVerify } from "jose"

/**
 * JWT propio para clientes móviles nativos (Flutter), separado de la sesión
 * por cookie de NextAuth (pensada para navegadores). Ver
 * plentypay_mobile/lib/features/auth/data/auth_repository.dart.
 *
 * Usa su PROPIO secreto (MOBILE_JWT_SECRET) — nunca reutilizar NEXTAUTH_SECRET
 * aquí, para poder rotar uno sin invalidar el otro.
 */

const encoder = new TextEncoder()

function getSecretKey() {
  const secret = process.env.MOBILE_JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "MOBILE_JWT_SECRET no está configurada o es demasiado corta (mínimo 32 caracteres) — ver .env.example."
    )
  }
  return encoder.encode(secret)
}

export interface MobileJwtPayload {
  sub: string // userId
  clientId: string
  role: string
}

export async function signMobileJwt(payload: MobileJwtPayload): Promise<string> {
  return new SignJWT({ clientId: payload.clientId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d") // igual que la sesión web actual (ver docs/SECURITY.md)
    .sign(getSecretKey())
}

export async function verifyMobileJwt(token: string): Promise<MobileJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (!payload.sub || typeof payload.clientId !== "string" || typeof payload.role !== "string") {
      return null
    }
    return { sub: payload.sub, clientId: payload.clientId, role: payload.role }
  } catch {
    return null // firma inválida, expirado, o malformado — siempre null, nunca lanzar hacia rutas que no lo esperen
  }
}
