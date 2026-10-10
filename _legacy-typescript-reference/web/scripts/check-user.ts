/**
 * Script para verificar un usuario y probar su login
 * 
 * USO:
 *   npx tsx scripts/check-user.ts <email> <password>
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function checkUser() {
  try {
    const email = process.argv[2] || process.env.SUPER_ADMIN_EMAIL || 'admin@plentypay.com'
    const password = process.argv[3]

    if (!password) {
      console.log('❌ Error: Debes proporcionar una contraseña')
      console.log('\nUSO:')
      console.log('  npx tsx scripts/check-user.ts <email> <password>')
      console.log('\nEjemplo:')
      console.log('  npx tsx scripts/check-user.ts admin@plentypay.com Admin123!')
      process.exit(1)
    }

    console.log('🔍 Verificando credenciales...\n')
    console.log('   Email:', email)
    console.log('   Password:', '*'.repeat(password.length))

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    })

    if (!user) {
      console.log('\n❌ Usuario NO encontrado con email:', email)
      console.log('\n📋 Usuarios disponibles:')
      
      const allUsers = await prisma.user.findMany({
        select: {
          email: true,
          role: true,
          isActive: true,
        },
      })
      
      allUsers.forEach(u => {
        console.log(`   - ${u.email} (${u.role}) ${u.isActive ? '✓' : '✗ INACTIVO'}`)
      })
      
      process.exit(1)
    }

    console.log('\n✅ Usuario encontrado:')
    console.log('   ID:', user.id)
    console.log('   Nombre:', user.name)
    console.log('   Email:', user.email)
    console.log('   Rol:', user.role)
    console.log('   Activo:', user.isActive ? 'Sí ✓' : 'No ✗')
    console.log('   Organización:', user.organization?.name || 'N/A')
    console.log('   Password hash:', user.password?.substring(0, 30) + '...')

    if (!user.password) {
      console.log('\n❌ El usuario NO tiene contraseña configurada!')
      process.exit(1)
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password)

    console.log('\n🔐 Verificación de contraseña:', isValid ? '✅ CORRECTA' : '❌ INCORRECTA')

    if (!isValid) {
      console.log('\n⚠️  La contraseña proporcionada NO coincide con el hash almacenado.')
      console.log('\n💡 Para resetear la contraseña, ejecuta:')
      console.log('   npx tsx scripts/reset-super-admin.ts <nueva-contraseña>')
    } else {
      console.log('\n✅ Las credenciales son válidas!')
      console.log('   Puedes iniciar sesión en: http://localhost:3000/auth/signin')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

