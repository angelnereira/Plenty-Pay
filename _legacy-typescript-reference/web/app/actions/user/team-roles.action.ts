'use server'

import { auth } from '@core/auth'
import { prismaServer as prisma } from '@core/database'
import { BASE_ROLE_TEMPLATES, type ModulePermission } from '@/lib/constants/permissions'
import { assertWithinUserLimit, LimitExceededError } from '@/lib/limits/enforcement'
import { z } from 'zod'
import { hash } from 'bcryptjs'

// ============================================
// Team Roles CRUD
// ============================================

export async function getTeamRoles() {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const roles = await prisma.teamRole.findMany({
    where: { clientId: session.user.clientId },
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return { success: true, data: roles }
}

const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(200).optional(),
  permissions: z.array(z.object({
    module: z.string(),
    actions: z.array(z.string()),
  })),
})

export async function createTeamRole(data: z.infer<typeof createRoleSchema>) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const parsed = createRoleSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Datos inválidos' }

  try {
    const role = await prisma.teamRole.create({
      data: {
        clientId: session.user.clientId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        permissions: parsed.data.permissions as any,
      },
    })
    return { success: true, data: role }
  } catch (e: any) {
    if (e.code === 'P2002') return { success: false, error: 'Ya existe un rol con ese identificador' }
    return { success: false, error: 'Error al crear el rol' }
  }
}

export async function updateTeamRole(id: string, data: Partial<z.infer<typeof createRoleSchema>>) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  try {
    const role = await prisma.teamRole.update({
      where: { id, clientId: session.user.clientId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.permissions && { permissions: data.permissions as any }),
      },
    })
    return { success: true, data: role }
  } catch {
    return { success: false, error: 'Error al actualizar el rol' }
  }
}

export async function deleteTeamRole(id: string) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const role = await prisma.teamRole.findUnique({
    where: { id, clientId: session.user.clientId },
    include: { _count: { select: { users: true } } },
  })

  if (!role) return { success: false, error: 'Rol no encontrado' }
  if (role.isSystem) return { success: false, error: 'No se puede eliminar un rol del sistema' }
  if (role._count.users > 0) return { success: false, error: 'No se puede eliminar un rol con usuarios asignados' }

  await prisma.teamRole.delete({ where: { id } })
  return { success: true }
}

/**
 * Initialize default team roles for a client from base templates.
 */
export async function initializeDefaultRoles() {
  const session = await auth()
  const clientId = session?.user?.clientId
  if (!clientId) return { success: false, error: 'No autorizado' }

  const existing = await prisma.teamRole.count({
    where: { clientId },
  })

  if (existing > 0) return { success: true, data: 'Roles ya inicializados' }

  const roles = Object.values(BASE_ROLE_TEMPLATES).map(template => ({
    clientId,
    name: template.name,
    slug: template.slug,
    description: template.description,
    isSystem: true,
    permissions: template.permissions as any,
  }))

  await prisma.teamRole.createMany({ data: roles })
  return { success: true }
}

// ============================================
// Team Members CRUD
// ============================================

export async function getTeamMembers() {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const members = await prisma.teamMember.findMany({
    where: { clientId: session.user.clientId },
    include: {
      user: { select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, image: true } },
      teamRole: { select: { id: true, name: true, slug: true, permissions: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return { success: true, data: members }
}

const createMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8),
  teamRoleId: z.string(),
  permissionOverrides: z.object({
    grants: z.array(z.object({ module: z.string(), actions: z.array(z.string()) })),
    revokes: z.array(z.object({ module: z.string(), actions: z.array(z.string()) })),
  }).optional(),
})

export async function createTeamMember(data: z.infer<typeof createMemberSchema>) {
  const session = await auth()
  const clientId = session?.user?.clientId
  if (!clientId) return { success: false, error: 'No autorizado' }

  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Datos inválidos: ' + parsed.error.issues.map(i => i.message).join(', ') }

  // Check user limit (centralizado en lib/limits/enforcement.ts)
  try {
    await assertWithinUserLimit(clientId)
  } catch (e) {
    if (e instanceof LimitExceededError) return { success: false, error: e.message }
    throw e
  }

  // Check role belongs to this client
  const role = await prisma.teamRole.findUnique({
    where: { id: parsed.data.teamRoleId, clientId },
  })

  if (!role) return { success: false, error: 'Rol no encontrado' }

  try {
    const hashedPassword = await hash(parsed.data.password, 12)

    // Create user and team member in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          password: hashedPassword,
          clientId,
          role: 'CLIENT',
        },
      })

      const member = await tx.teamMember.create({
        data: {
          clientId,
          userId: user.id,
          teamRoleId: parsed.data.teamRoleId,
          permissionOverrides: parsed.data.permissionOverrides as any,
        },
        include: {
          user: { select: { id: true, email: true, name: true, isActive: true } },
          teamRole: { select: { id: true, name: true, slug: true } },
        },
      })

      return member
    })

    return { success: true, data: result }
  } catch (e: any) {
    if (e.code === 'P2002') return { success: false, error: 'Ya existe un usuario con ese correo electrónico' }
    return { success: false, error: 'Error al crear el miembro del equipo' }
  }
}

export async function updateTeamMember(
  memberId: string,
  data: { teamRoleId?: string; permissionOverrides?: any; isActive?: boolean }
) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  try {
    const member = await prisma.teamMember.update({
      where: { id: memberId, clientId: session.user.clientId },
      data: {
        ...(data.teamRoleId && { teamRoleId: data.teamRoleId }),
        ...(data.permissionOverrides !== undefined && { permissionOverrides: data.permissionOverrides }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        user: { select: { id: true, email: true, name: true, isActive: true } },
        teamRole: { select: { id: true, name: true, slug: true } },
      },
    })

    // Sync isActive to User model
    if (data.isActive !== undefined) {
      await prisma.user.update({
        where: { id: member.userId },
        data: { isActive: data.isActive },
      })
    }

    return { success: true, data: member }
  } catch {
    return { success: false, error: 'Error al actualizar el miembro' }
  }
}

export async function removeTeamMember(memberId: string) {
  const session = await auth()
  if (!session?.user?.clientId) return { success: false, error: 'No autorizado' }

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId, clientId: session.user.clientId },
  })

  if (!member) return { success: false, error: 'Miembro no encontrado' }

  // Don't allow removing yourself
  if (member.userId === session.user.id) {
    return { success: false, error: 'No puedes eliminarte a ti mismo' }
  }

  await prisma.$transaction([
    prisma.teamMember.delete({ where: { id: memberId } }),
    prisma.user.update({
      where: { id: member.userId },
      data: { isActive: false },
    }),
  ])

  return { success: true }
}
