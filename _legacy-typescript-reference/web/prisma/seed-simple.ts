import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed simple de la base de datos...')

  // Crear cliente de ejemplo
  const client = await prisma.client.upsert({
    where: { ruc: '123456789-1' },
    update: {},
    create: {
      slug: 'empresa-demo',
      name: 'Empresa Demo S.A.',
      ruc: '123456789-1',
      dv: '1',
      email: 'demo@empresa.com',
      phone: '+507 1234-5678',
      address: 'Panamá, Panamá',
      hkaEnabled: true,
      maxUsers: 10,
      maxFolios: 1000,
      isActive: true,
      metadata: JSON.stringify({
        theme: 'light',
        timezone: 'America/Panama',
        currency: 'PAB',
        language: 'es'
      })
    },
  })

  console.log('[SUCCESS] Cliente creado:', client.name)

  // Crear Super Admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@plentypay.com'
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD
  if (!superAdminPassword) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPER_ADMIN_PASSWORD must be set in production. Generate one with: openssl rand -base64 32')
    }
    console.warn('⚠️  SUPER_ADMIN_PASSWORD not set — using fallback. Do NOT use this in production.')
  }
  const finalPassword = superAdminPassword || 'admin123'

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      name: 'Super Admin',
      password: await bcrypt.hash(finalPassword, 12),
      role: 'SUPER_ADMIN',
      isActive: true,
      clientId: client.id,
    },
  })

  console.log('[SUCCESS] Super Admin creado:', superAdmin.email)
  console.log('🔑 Contraseña:', finalPassword)

  // Crear usuario de prueba
  const testUser = await prisma.user.upsert({
    where: { email: 'usuario@empresa.com' },
    update: {},
    create: {
      email: 'usuario@empresa.com',
      name: 'Usuario Demo',
      password: await bcrypt.hash('usuario123', 12),
      role: 'CLIENT',
      clientId: client.id,
      isActive: true,
    },
  })

  console.log('[SUCCESS] Usuario de prueba creado:', testUser.email)

  console.log('🎉 Seed completado exitosamente!')
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
