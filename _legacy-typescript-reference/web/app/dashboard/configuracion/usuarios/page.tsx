import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer as prisma } from "@core/database"
import { TeamManagementClient } from "./team-management-client"

export default async function TeamManagementPage() {
  const session = await auth()
  const clientId = session?.user?.clientId
  if (!clientId) redirect("/dashboard")

  // Initialize default roles if none exist
  const roleCount = await prisma.teamRole.count({
    where: { clientId },
  })

  if (roleCount === 0) {
    const { BASE_ROLE_TEMPLATES } = await import('@/lib/constants/permissions')
    const roles = Object.values(BASE_ROLE_TEMPLATES).map(template => ({
      clientId,
      name: template.name,
      slug: template.slug,
      description: template.description,
      isSystem: true,
      permissions: template.permissions as any,
    }))
    await prisma.teamRole.createMany({ data: roles as any })
  }

  // Fetch roles and members
  const [roles, members, client] = await Promise.all([
    prisma.teamRole.findMany({
      where: { clientId },
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.teamMember.findMany({
      where: { clientId },
      include: {
        user: { select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true } },
        teamRole: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { maxUsers: true },
    }),
  ])

  const currentUserCount = await prisma.user.count({
    where: { clientId, isActive: true },
  })

  return (
    <TeamManagementClient
      initialRoles={JSON.parse(JSON.stringify(roles))}
      initialMembers={JSON.parse(JSON.stringify(members))}
      maxUsers={client?.maxUsers ?? 3}
      currentUserCount={currentUserCount}
      currentUserId={session.user.id}
    />
  )
}
