/**
 * NextAuth.js v5 Main Configuration
 * 
 * Este archivo combina la configuración de auth.config.ts con
 * opciones adicionales como session strategy y secret.
 * 
 * @see https://authjs.dev/getting-started/migrating-to-v5
 */

import NextAuth from 'next-auth'
import authConfig from './auth.config'
import { SESSION } from '@/lib/constants/config'

// Session update age: renew token every 24 hours if active
const SESSION_UPDATE_AGE = 24 * 60 * 60

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: 'jwt',
    maxAge: SESSION.MAX_AGE, // 30 days — aligned with refresh token expiration
    updateAge: SESSION_UPDATE_AGE,
  },
  jwt: {
    maxAge: SESSION.MAX_AGE,
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION.MAX_AGE,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

