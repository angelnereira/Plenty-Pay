import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/health/db
 *
 * Diagnóstico de conexión a la base de datos usando el mismo cliente
 * Prisma que usa el sistema de autenticación (prismaServer / @core/database).
 *
 * Requiere header: x-health-secret = NEXTAUTH_SECRET (o NODE_ENV=development)
 * Así se evita exponer detalles de error a usuarios anónimos en producción.
 */
export async function GET(request: NextRequest) {
  // Protección mínima: solo accesible en desarrollo O con el secret correcto
  const isDevEnv = process.env.NODE_ENV !== 'production'
  const providedSecret = request.headers.get('x-health-secret')
  const expectedSecret = process.env.NEXTAUTH_SECRET

  if (!isDevEnv && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL
      ? maskDatabaseUrl(process.env.DATABASE_URL)
      : '⚠️  DATABASE_URL is NOT SET',
    nextauthSecret: process.env.NEXTAUTH_SECRET ? '✅ set' : '⚠️  NOT SET',
    nextauthUrl: process.env.NEXTAUTH_URL ?? '⚠️  NOT SET',
  }

  // Test 1: DB connection básica
  try {
    const { prismaServer } = await import('@core/database')
    await prismaServer.$queryRaw`SELECT 1 AS ok`
    report.dbConnection = '✅ OK'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    report.dbConnection = `❌ FAILED: ${message}`
    return NextResponse.json({ status: 'error', ...report }, { status: 503 })
  }

  // Test 2: Tabla de usuarios accesible
  try {
    const { prismaServer } = await import('@core/database')
    const count = await prismaServer.user.count()
    report.userTableAccess = `✅ OK — ${count} usuarios`
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    report.userTableAccess = `❌ FAILED: ${message}`
  }

  // Test 3: Verificar que NEXTAUTH_SECRET no cambió (tamaño razonable)
  const secretLen = process.env.NEXTAUTH_SECRET?.length ?? 0
  report.nextauthSecretLength = secretLen >= 32
    ? `✅ OK (${secretLen} chars)`
    : `⚠️  Demasiado corto: ${secretLen} chars (mínimo recomendado: 32)`

  return NextResponse.json({ status: 'ok', ...report })
}

/**
 * Oculta la contraseña de la DATABASE_URL para mostrarla de forma segura.
 * Ejemplo: postgresql://user:REDACTED@host/db?sslmode=require&channel_binding=require
 */
function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = 'REDACTED'
    return u.toString()
  } catch {
    // Si no es una URL válida, ocultar todo
    return url.replace(/:([^@]+)@/, ':REDACTED@')
  }
}
