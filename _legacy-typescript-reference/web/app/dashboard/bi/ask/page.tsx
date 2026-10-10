import { Crown, Sparkles } from "lucide-react"
import Link from "next/link"
import { requireBIAccess } from "@/features/bi"
import { AskClient } from "@/features/bi/ui/ask-client"

export const dynamic = "force-dynamic"

export default async function BIAskPage() {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Pregúntale a tu BI</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Haz preguntas en lenguaje natural sobre tu negocio y obtén respuestas con
                    datos reales. <strong>BI Pro</strong>.
                </p>
                <Link href="/dashboard/configuracion" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500">
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <header>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500" />
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Pregúntale a tu BI
                    </h1>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Lenguaje natural sobre tus datos. Clasificamos tu pregunta a una consulta segura,
                    la corremos contra tus vistas y te devolvemos una respuesta concisa.
                </p>
            </header>
            <AskClient />
        </div>
    )
}
