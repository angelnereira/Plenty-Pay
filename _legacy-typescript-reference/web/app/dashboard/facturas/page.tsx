import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { FacturasPageClient } from "./facturas-page-client"
import { getInvoices } from "@/actions/invoice-actions"

export default async function FacturasPage() {
  const session = await auth()

  if (!session) {
    redirect("/")
  }

  const clientId = session.user?.clientId
  const userName = session.user?.name || "Usuario"

  if (!clientId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Sin Organización
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Tu usuario no tiene una organización asignada
          </p>
        </div>
      </div>
    )
  }

  const result = await getInvoices()

  if (!result.success || !result.data) {
    // Handle error case, maybe show error within client component or fallback
    console.error("Failed to fetch invoices:", result.error)
    // We can pass empty data or specialized error state
  }

  const initialData = result.data || {
    invoices: [],
    stats: {
      total: 0,
      emitted: 0,
      draft: 0,
      processing: 0,
      error: 0,
      canceled: 0,
      totalAmount: 0,
      totalItbms: 0
    }
  }

  return <FacturasPageClient initialData={initialData} userName={userName} />
}

