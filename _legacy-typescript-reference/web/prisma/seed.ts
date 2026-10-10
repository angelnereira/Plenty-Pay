import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

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
  const finalPassword = superAdminPassword || '72bb9e47a5373f74cb1e31b065aaec45'

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

  // Crear pool de folios
  const folioPool = await prisma.folioPool.upsert({
    where: { batchNumber: 'BATCH-001' },
    update: {},
    create: {
      batchNumber: 'BATCH-001',
      provider: 'HKA',
      totalFolios: 1000,
      availableFolios: 1000,
      assignedFolios: 0,
      consumedFolios: 0,
      purchaseAmount: 1000.00,
      hkaInvoiceNumber: 'HKA-INV-001',
      folioStart: 'FOL-000001',
      folioEnd: 'FOL-001000',
      isActive: true,
      metadata: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        provider: 'HKA'
      })
    }
  })

  console.log('[SUCCESS] Pool de folios creado:', folioPool.batchNumber)

  // Asignar folios al cliente
  const folioAssignment = await prisma.folioAssignment.upsert({
    where: {
      folioPoolId_clientId: {
        folioPoolId: folioPool.id,
        clientId: client.id
      }
    },
    update: {},
    create: {
      folioPoolId: folioPool.id,
      clientId: client.id,
      assignedAmount: 100,
      consumedAmount: 0,
      alertThreshold: 10,
      assignedBy: superAdmin.id,
      notes: 'Asignación inicial de folios para demo'
    }
  })

  console.log('[SUCCESS] Asignación de folios creada:', folioAssignment.id)

  // Crear algunas facturas de ejemplo
  for (let i = 1; i <= 5; i++) {
    const invoice = await prisma.invoice.create({
      data: {
        clientId: client.id,
        createdBy: testUser.id,
        clientReferenceId: `REF-${String(i).padStart(4, '0')}`,
        issuerRuc: client.ruc || "000000000000",
        issuerDv: client.dv || "00",
        issuerName: client.name,
        issuerAddress: client.address || "N/A",
        issuerEmail: client.email || "no-email@example.com",
        issuerPhone: client.phone || "N/A",
        receiverType: 'CONTRIBUTOR',
        receiverRuc: `12345678-${i}`,
        receiverDv: String(i),
        receiverName: `Cliente ${i}`,
        receiverEmail: `cliente${i}@email.com`,
        receiverPhone: `+507 1234-${String(i).padStart(4, '0')}`,
        receiverAddress: `Dirección Cliente ${i}`,
        documentType: 'FACTURA',
        subtotal: 100.00,
        discount: 0,
        subtotalAfterDiscount: 100.00,
        itbms: 7.00,
        total: 107.00,
        currency: 'PAB',
        status: 'DRAFT',
        notes: `Factura de prueba ${i}`,
        internalNotes: `Notas internas para factura ${i}`
      }
    })

    // Crear items para la factura
    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        lineNumber: 1,
        code: `PROD-${String(i).padStart(3, '0')}`,
        description: `Producto/Servicio ${i}`,
        quantity: 1,
        unitPrice: 100.00,
        unit: 'UND',
        discount: 0,
        discountRate: 0,
        taxRate: 7,
        taxCode: '01',
        taxAmount: 7.00,
        subtotal: 100.00,
        total: 107.00
      }
    })

    // Crear log inicial
    await prisma.invoiceLog.create({
      data: {
        invoiceId: invoice.id,
        action: 'CREATED',
        message: `Factura ${i} creada por usuario demo`,
        userId: testUser.id,
        userEmail: testUser.email
      }
    })
  }

  console.log('[SUCCESS] 5 facturas de ejemplo creadas con items y logs')

  // Crear notificaciones de ejemplo
  await prisma.notification.createMany({
    data: [
      {
        userId: superAdmin.id,
        type: 'SYSTEM_ALERT',
        title: 'Bienvenido a PlentyPay',
        message: 'Sistema configurado exitosamente. Puedes comenzar a crear facturas.',
        link: '/dashboard'
      },
      {
        userId: testUser.id,
        type: 'FOLIOS_ASSIGNED',
        title: 'Folios Asignados',
        message: 'Se han asignado 100 folios a tu organización.',
        link: '/dashboard/folios'
      }
    ]
  })

  console.log('[SUCCESS] Notificaciones de ejemplo creadas')

  // Crear configuración del sistema
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'app_name',
        value: 'PlentyPay',
        description: 'Nombre de la aplicación'
      },
      {
        key: 'app_version',
        value: '1.0.0',
        description: 'Versión de la aplicación'
      },
      {
        key: 'email_notifications_enabled',
        value: (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true').toString(),
        description: 'Habilitar notificaciones por email'
      }
    ]
  })

  console.log('[SUCCESS] Configuración del sistema creada')

  console.log('🎉 Seed completado exitosamente!')
  console.log('\n📋 Credenciales de acceso:')
  console.log(`Super Admin: ${superAdminEmail} / ${finalPassword}`)
  console.log('Usuario Demo: usuario@empresa.com / usuario123')
  console.log('\n🔗 URLs importantes:')
  console.log('- Dashboard: http://localhost:3000/dashboard')
  console.log('- Prisma Studio: npm run db:studio')
  // ... (previous code) ...

  // Call Payday Seed
  await seedPayday(prisma, client.id);
}

async function seedPayday(prisma: PrismaClient, clientId: string) {
  console.log('💰 Iniciando seed del módulo Payday...');

  // 1. Configurar Payday para el cliente
  await prisma.client.update({
    where: { id: clientId },
    data: {
      paydayEnabled: true
    }
  });

  const paydayConfig = await prisma.paydayConfig.upsert({
    where: { clientId: clientId },
    update: {},
    create: {
      clientId: clientId,
      commercialZone: 'NORMAL',
      operationalHours: {
        monday: { start: '08:00', end: '17:00' },
        tuesday: { start: '08:00', end: '17:00' },
        wednesday: { start: '08:00', end: '17:00' },
        thursday: { start: '08:00', end: '17:00' },
        friday: { start: '08:00', end: '17:00' }
      },
      payFrequency: 'BIWEEKLY'
    }
  });

  // 2. Crear Empleados
  const employeeData = [
    {
      firstName: 'Juan',
      lastName: 'Pérez',
      cedula: '8-123-456',
      email: 'juan.perez@example.com',
      contractType: 'INDEFINIDO',
      paymentMode: 'TIEMPO',
      baseSalary: 1200.00,
      hourlyRate: 7.50, // ~$1200/160h
      pinCode: '1234'
    },
    {
      firstName: 'Maria',
      lastName: 'González',
      cedula: '8-222-333',
      email: 'maria.g@example.com',
      contractType: 'DEFINIDO',
      paymentMode: 'TIEMPO',
      baseSalary: 800.00,
      hourlyRate: 5.00,
      pinCode: '5678'
    },
    {
      firstName: 'Carlos',
      lastName: 'Nightshift',
      cedula: '8-999-000',
      email: 'carlos.night@example.com',
      contractType: 'INDEFINIDO',
      paymentMode: 'TIEMPO',
      baseSalary: 950.00,
      hourlyRate: 5.93,
      pinCode: '0000'
    }
  ];

  for (const emp of employeeData) {
    await prisma.paydayEmployee.upsert({
      where: {
        clientId_cedula: {
          clientId: clientId,
          cedula: emp.cedula
        }
      },
      update: {},
      create: {
        clientId: clientId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        cedula: emp.cedula,
        email: emp.email,
        contractType: emp.contractType as any,
        paymentMode: emp.paymentMode as any,
        baseSalary: emp.baseSalary,
        hourlyRate: emp.hourlyRate,
        pinCode: emp.pinCode,
        isActive: true
      }
    });
  }

  console.log('[SUCCESS] Payday seed completado para cliente:', clientId);


}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
