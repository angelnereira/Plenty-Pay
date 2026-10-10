/**
 * NextAuth.js v5 Configuration (Edge-compatible)
 * 
 * Este archivo contiene la configuración de NextAuth compatible con Edge Runtime.
 * NO debe importar módulos que dependan de Node.js (como Prisma directamente).
 * 
 * @see https://authjs.dev/getting-started/migrating-to-v5
 */

import type { NextAuthConfig } from 'next-auth'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { SESSION } from '@/lib/constants/config'

// Schema de validación para login
// Note: rememberMe is intentionally excluded — NextAuth serializes credentials
// as URL-encoded strings, so boolean false becomes "false" which z.boolean() rejects.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export default {
  providers: [
    {
      id: "credentials",
      name: "Credentials",
      type: "credentials",
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        impersonationToken: { label: 'Impersonation Token', type: 'text' },
      },
      async authorize(credentials) {
        console.log('[Auth Debug] Authorize called with:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          hasImpersonationToken: !!credentials?.impersonationToken
        })

        // Soporte para Impersonation (Suplantación con seguridad mejorada)
        if (credentials.impersonationToken) {
          try {
            const { verifyImpersonationToken } = await import('./impersonation')
            // Verificar token firmado con HMAC-SHA256
            const payload = await verifyImpersonationToken(credentials.impersonationToken as string)

            if (!payload) {
              console.warn('[Auth Debug] Invalid or expired impersonation token')
              return null
            }

            const { prismaServer } = await import('@core/database')
            const user = await prismaServer.user.findUnique({
              where: { id: payload.targetUserId },
              include: { client: true }
            })

            if (!user) {
              console.warn(`[Auth Debug] Target user not found for impersonation: ${payload.targetUserId}`)
              return null
            }

            // Log successful impersonation for audit trail
            console.info(`[Auth Debug] Successful impersonation by admin ${payload.adminId} for user ${user.email}`)

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              clientId: user.clientId,
              approvalStatus: user.client?.approvalStatus ?? 'PENDING',
              inventoryEnabled: user.client?.inventoryEnabled ?? false,
              posEnabled: user.client?.posEnabled ?? false,
              paydayEnabled: user.client?.paydayEnabled ?? false,
              logisticsEnabled: user.client?.logisticsEnabled ?? false,
              creditosEnabled: user.client?.creditosEnabled ?? false,
            }

          } catch (e) {
            console.error('[Auth Debug] Impersonation error', e)
            return null
          }
        }

        // Validar input normal
        const validatedFields = loginSchema.safeParse(credentials)

        if (!validatedFields.success) {
          console.warn('[Auth Debug] Validation failed:', validatedFields.error)
          return null
        }

        const { email, password } = validatedFields.data


        try {
          // IMPORTANTE: Usar import dinámico para evitar problemas con Edge
          const { prismaServer } = await import('@core/database')

          // Buscar usuario
          const user = await prismaServer.user.findUnique({
            where: { email },
            include: {
              client: true,
            },
          })

          if (!user || !user.password) {
            console.warn(`[Auth Debug] User not found or no password set: ${email}`)
            return null
          }

          console.log('[Auth Debug] User found:', {
            id: user.id,
            email: user.email,
            isActive: user.isActive,
            clientActive: user.client?.isActive,
            clientName: user.client?.name
          })

          // VERIFICACIÓN DE STATUS (KILL SWITCH)
          // 1. Usuario activo
          if (!user.isActive) {
            console.warn(`[Auth Debug] User is inactive: ${email}`)
            return null // O lanzar error específico si NextAuth lo permite visualmente
          }

          // 2. Cliente/Organización activa (y no suspendida)
          // Allow SUPER_ADMIN to bypass this check to prevent lockout
          if (user.role !== 'SUPER_ADMIN') {
            if (!user.client || !user.client.isActive) {
              console.warn(`[Auth Debug] Client is inactive or missing for user: ${email}`)
              return null
            }
          }

          // Verificar password con bcryptjs (compatible con Edge)
          const passwordsMatch = await compare(password, user.password)

          if (!passwordsMatch) {
            console.warn(`[Auth Debug] Invalid password for user: ${email}`)
            return null
          }

          console.log('[Auth Debug] Password match successful')

          // Devolver usuario sin password
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.clientId,
            approvalStatus: user.client?.approvalStatus ?? 'PENDING',
            inventoryEnabled: user.client?.inventoryEnabled ?? false,
            posEnabled: user.client?.posEnabled ?? false,
            paydayEnabled: user.client?.paydayEnabled ?? false,
            logisticsEnabled: user.client?.logisticsEnabled ?? false,
            creditosEnabled: user.client?.creditosEnabled ?? false,
            rememberMe: credentials.rememberMe === true || credentials.rememberMe === 'true',
          }
        } catch (error) {
          // Loguear el error completo para diagnóstico en Vercel logs
          // Errores comunes: DATABASE_URL inválida, timeout de conexión, Prisma no inicializado
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorCode = (error as Record<string, unknown>)?.code
          console.error('[Auth Debug] Unexpected authentication error', {
            message: errorMessage,
            code: errorCode,
            databaseUrl: process.env.DATABASE_URL
              ? `${process.env.DATABASE_URL.split('@')[1] ?? '(no host)'}` // Solo host, sin credenciales
              : '⚠️  DATABASE_URL NOT SET',
            nextauthUrl: process.env.NEXTAUTH_URL,
          })
          return null
        }
      },
    },
  ],
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }): Promise<any> {
      // Initial sign in - create new tokens
      if (user) {
        const { createTokenTimestamps } = await import('./token-rotation')
        const timestamps = createTokenTimestamps()

        return {
          ...token,
          id: user.id,
          role: user.role,
          clientId: user.clientId,
          approvalStatus: user.approvalStatus,
          facturacionEnabled: user.facturacionEnabled,
          inventoryEnabled: user.inventoryEnabled,
          posEnabled: user.posEnabled,
          paydayEnabled: user.paydayEnabled,
          logisticsEnabled: user.logisticsEnabled,
          creditosEnabled: user.creditosEnabled ?? false,
          persist: (user as Record<string, any>).rememberMe ?? false,
          ...timestamps,
        }
      }

      // Check if password was changed after token was issued (session invalidation)
      if (token.id && token.iat) {
        try {
          const { prismaServer } = await import('@core/database')
          const dbUser = await prismaServer.user.findUnique({
            where: { id: token.id as string },
            select: { passwordChangedAt: true, isActive: true, status: true },
          })
          if (dbUser?.passwordChangedAt) {
            const changedAtSec = Math.floor(dbUser.passwordChangedAt.getTime() / 1000)
            if (changedAtSec > (token.iat as number)) {
              return { ...token, error: 'PasswordChanged' }
            }
          }
          if (dbUser && !dbUser.isActive) {
            return { ...token, error: 'UserDeactivated' }
          }
        } catch {
          // Fail open - don't block auth if DB check fails
        }
      }

      // Return previous token if access token hasn't expired yet
      const accessTokenExpires = token.accessTokenExpires as number | undefined
      if (accessTokenExpires && Date.now() < accessTokenExpires) {
        return token
      }

      // Access token expired - check refresh token
      const refreshTokenExpires = token.refreshTokenExpires as number | undefined
      if (!refreshTokenExpires || Date.now() >= refreshTokenExpires) {
        // Refresh token also expired - user needs to re-login
        console.warn('Session expired - refresh token invalid')
        return {
          ...token,
          error: 'RefreshTokenExpired',
        }
      }

      // Re-verify user status and refresh module flags from DB
      try {
        const { prismaServer } = await import('@core/database')
        const dbUser = await prismaServer.user.findUnique({
          where: { id: token.id as string },
          include: { client: true },
        })

        if (!dbUser || !dbUser.isActive) {
          return { ...token, error: 'RefreshTokenExpired' }
        }

        if (dbUser.role !== 'SUPER_ADMIN' && (!dbUser.client || !dbUser.client.isActive)) {
          return { ...token, error: 'RefreshTokenExpired' }
        }

        // Update module flags from DB
        token.facturacionEnabled = dbUser.client?.facturacionEnabled ?? false
        token.inventoryEnabled = dbUser.client?.inventoryEnabled ?? false
        token.posEnabled = dbUser.client?.posEnabled ?? false
        token.paydayEnabled = dbUser.client?.paydayEnabled ?? false
        token.logisticsEnabled = dbUser.client?.logisticsEnabled ?? false
        token.creditosEnabled = dbUser.client?.creditosEnabled ?? false
        token.approvalStatus = dbUser.client?.approvalStatus ?? 'PENDING'
      } catch (e) {
        console.error('Error refreshing user data from DB', e)
      }

      // Refresh the access token
      const { refreshAccessToken } = await import('./token-rotation')
      console.info('Refreshing access token silently')
      return refreshAccessToken(token as any)
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.clientId = token.clientId as string
        session.user.approvalStatus = token.approvalStatus as string
        session.user.facturacionEnabled = token.facturacionEnabled as boolean
        session.user.inventoryEnabled = token.inventoryEnabled as boolean
        session.user.posEnabled = token.posEnabled as boolean
        session.user.paydayEnabled = token.paydayEnabled as boolean
        session.user.logisticsEnabled = token.logisticsEnabled as boolean
        session.user.creditosEnabled = (token.creditosEnabled as boolean | undefined) ?? false
      }

      if (token.error) {
        (session as Record<string, any>).error = token.error
      }

      return session
    },
  },
  // Session configuration for token rotation
  session: {
    strategy: SESSION.STRATEGY,
    maxAge: SESSION.MAX_AGE, // 30 days (matches refresh token)
  },
  trustHost: true,
} satisfies NextAuthConfig
