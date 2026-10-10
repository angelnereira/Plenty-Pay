import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { prismaServer } from "@core/database"
import { OrganizationSettings } from "@/components/configuration/organization-settings"
import { Building2 } from "lucide-react"

export default async function OrganizacionConfigPage() {
  const session = await auth()

  if (!session?.user?.id || !session.user.clientId) {
    redirect("/")
  }

  const client = await prismaServer.client.findUnique({
    where: { id: session.user.clientId },
    select: {
      id: true,
      name: true,
      ruc: true,
      dv: true,
      rucType: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      logo: true,
      isActive: true,
    },
  })

  if (!client) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
            <Building2 className="h-8 w-8 text-slate-400" />
            Organización
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Información legal y fiscal de tu empresa: RUC, DV y datos de contacto.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 md:p-8">
          <OrganizationSettings organization={client} />
        </div>
      </div>
    </div>
  )
}
