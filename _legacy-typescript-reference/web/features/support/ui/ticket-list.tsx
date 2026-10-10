"use client"

import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    MessageSquare,
    User,
    MoreHorizontal,
    ChevronRight
} from "lucide-react"

interface TicketListProps {
    tickets: any[]
    onSelect?: (ticket: any) => void
}

export function SupportTicketList({ tickets, onSelect }: TicketListProps) {
    if (tickets.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="bg-zinc-100 dark:bg-zinc-800 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-8 w-8 text-zinc-400" />
                </div>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No hay tickets registrados</p>
            </div>
        )
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "RESOLVED": return "text-green-500 bg-green-500/10"
            case "IN_PROGRESS": return "text-blue-500 bg-blue-500/10"
            case "CLOSED": return "text-zinc-500 bg-zinc-500/10"
            default: return "text-orange-500 bg-orange-500/10"
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "URGENT": return "bg-red-500"
            case "HIGH": return "bg-orange-500"
            case "MEDIUM": return "bg-blue-500"
            default: return "bg-zinc-400"
        }
    }

    return (
        <div className="space-y-4">
            {tickets.map((ticket) => (
                <div
                    key={ticket.id}
                    onClick={() => onSelect?.(ticket)}
                    className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group cursor-pointer"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
                                    {ticket.status}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-medium">#{ticket.id.substring(ticket.id.length - 6).toUpperCase()}</span>
                                {ticket.priority === "URGENT" && (
                                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" title="Urgente" />
                                )}
                            </div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight group-hover:text-black dark:group-hover:text-white transition-colors">
                                {ticket.subject}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1 font-medium">
                                {ticket.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-4 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                                    <User className="h-3.5 w-3.5" />
                                    <span>{ticket.user?.name || "Usuario"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{format(new Date(ticket.createdAt), "dd MMM, HH:mm", { locale: es })}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-tighter">
                                    <div className={`h-2 w-2 rounded-full ${getPriorityColor(ticket.priority)}`} />
                                    {ticket.priority}
                                </div>
                            </div>
                        </div>

                        <div className="flex md:flex-col items-center md:items-end gap-3 shrink-0">
                            <button className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl hover:bg-black hover:text-white transition-all">
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
