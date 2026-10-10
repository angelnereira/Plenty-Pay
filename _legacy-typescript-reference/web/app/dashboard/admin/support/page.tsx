"use client"

import { useState, useEffect } from "react"
import { SupportTicketList } from "@/features/support/ui/ticket-list"
import { SupportChat } from "@/features/support/ui/support-chat"
import { LifeBuoy, Loader2, RefreshCcw, Search, Filter, ArrowLeft } from "lucide-react"

export default function SupportAdminPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [tickets, setTickets] = useState([])
    const [selectedTicket, setSelectedTicket] = useState<any>(null)

    const fetchTickets = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/support/tickets")
            const data = await res.json()
            if (data.success) {
                setTickets(data.data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchTickets()
    }, [])

    if (selectedTicket) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SupportChat
                    ticket={selectedTicket}
                    onBack={() => {
                        setSelectedTicket(null)
                        fetchTickets()
                    }}
                />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 mb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 text-zinc-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Módulo de Asistencia</span>
                        <div className="h-px w-12 bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <h1 className="text-5xl font-black text-zinc-950 dark:text-white flex items-center gap-4 tracking-tighter">
                        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                            <LifeBuoy className="h-10 w-10 text-black dark:text-white" />
                        </div>
                        Tickets de Soporte
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchTickets}
                        className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 transition-all font-bold text-xs uppercase tracking-widest"
                    >
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Buscar por asunto, ID o cliente..."
                        className="w-full pl-12 pr-4 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all font-medium"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-6 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-black uppercase tracking-widest text-xs">
                    <Filter className="h-4 w-4" />
                    Filtros
                </button>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {isLoading && tickets.length === 0 ? (
                    <div className="flex h-96 items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
                            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Cargando Tickets...</p>
                        </div>
                    </div>
                ) : (
                    <SupportTicketList tickets={tickets} onSelect={setSelectedTicket} />
                )}
            </div>
        </div>
    )
}
