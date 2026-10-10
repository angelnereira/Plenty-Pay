"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircle2, XCircle, Clock, Mail, Users, ExternalLink } from "lucide-react"

export function CampaignList({ campaigns }: { campaigns: any[] }) {
    if (campaigns.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-200 dark:border-gray-700 text-center">
                <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No hay campañas enviadas aún.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em] mb-4">Historial de Envíos</h3>
            {campaigns.map((c) => (
                <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:border-primary/50 group">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                {c.status === "SENT" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : c.status === "SENDING" ? (
                                    <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`text-[10px] font-black uppercase tracking-widest ${c.status === "SENT" ? "text-green-500" : "text-blue-500"
                                    }`}>
                                    {c.status}
                                </span>
                            </div>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors">{c.subject}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mb-3">{c.content.replace(/<[^>]*>?/gm, '')}</p>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                                    <Users className="h-3.5 w-3.5" />
                                    <span>{c.totalSent} enviados</span>
                                </div>
                                {c.totalFailed > 0 && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-500">
                                        <XCircle className="h-3.5 w-3.5" />
                                        <span>{c.totalFailed} fallidos</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{format(new Date(c.createdAt), "dd MMM, HH:mm", { locale: es })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1 max-w-[150px] justify-end">
                            {c.targetPlans.map((p: string) => (
                                <span key={p} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-[9px] font-bold uppercase tracking-tighter">
                                    {p}
                                </span>
                            ))}
                            {c.targetPlans.length === 0 && (
                                <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded text-[9px] font-bold uppercase tracking-tighter">
                                    Todos
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
