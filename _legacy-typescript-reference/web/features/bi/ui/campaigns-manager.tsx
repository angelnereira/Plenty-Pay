"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Send, Loader2, Trash2, MessageCircle, Mail, X, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Channel = "whatsapp" | "email"

interface CampaignItem {
    id: string
    channel: Channel
    message: string
    status: string
    recipients: number
    conversions: number
    sentAt: string | null
    createdAt: string
    segment: { id: string; name: string; cachedCount: number } | null
}

interface SegmentRef {
    id: string
    name: string
    cachedCount: number
}

interface Props {
    initialCampaigns: CampaignItem[]
    segments: SegmentRef[]
    preselectedSegmentId: string | null
}

const CHANNEL_ICON: Record<Channel, typeof MessageCircle> = {
    whatsapp: MessageCircle,
    email: Mail,
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    DRAFT:     { label: "Borrador",  cls: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
    SCHEDULED: { label: "Agendada",  cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
    SENT:      { label: "Enviada",   cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    FAILED:    { label: "Fallida",   cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
}

export function CampaignsManager({ initialCampaigns, segments, preselectedSegmentId }: Props) {
    const router = useRouter()
    const [campaigns, setCampaigns] = useState<CampaignItem[]>(initialCampaigns)
    const [segmentId, setSegmentId] = useState<string>(preselectedSegmentId ?? segments[0]?.id ?? "")
    const [channel, setChannel] = useState<Channel>("whatsapp")
    const [message, setMessage] = useState("Hola {nombre}, queremos compartirte una promoción exclusiva esta semana.")
    const [creating, setCreating] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!segmentId) return setError("Selecciona un segmento.")
        if (message.trim().length < 2) return setError("El mensaje no puede estar vacío.")
        setError(null)
        setCreating(true)
        try {
            const res = await fetch("/api/bi/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ segmentId, channel, message: message.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            const seg = segments.find((s) => s.id === segmentId)
            const c: CampaignItem = {
                id: data.campaign.id,
                channel: data.campaign.channel,
                message: data.campaign.message,
                status: data.campaign.status,
                recipients: data.campaign.recipients,
                conversions: data.campaign.conversions,
                sentAt: null,
                createdAt: data.campaign.createdAt,
                segment: seg ? { id: seg.id, name: seg.name, cachedCount: seg.cachedCount } : null,
            }
            setCampaigns((prev) => [c, ...prev])
            setMessage("")
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setCreating(false)
        }
    }

    const send = async (c: CampaignItem) => {
        if (!confirm(`¿Marcar como enviada la campaña a ${c.recipients} destinatarios?`)) return
        setBusy(c.id)
        try {
            const res = await fetch(`/api/bi/campaigns/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "send" }),
            })
            const data = await res.json()
            if (res.ok) {
                setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: "SENT", sentAt: new Date().toISOString() } : x))
            }
            void data
        } finally {
            setBusy(null)
        }
    }

    const remove = async (c: CampaignItem) => {
        if (!confirm("¿Eliminar campaña?")) return
        setBusy(c.id)
        try {
            await fetch(`/api/bi/campaigns/${c.id}`, { method: "DELETE" })
            setCampaigns((prev) => prev.filter((x) => x.id !== c.id))
        } finally {
            setBusy(null)
        }
    }

    const inputCls = "h-10 w-full rounded-md px-3 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white"

    return (
        <div className="space-y-6">
            {segments.length === 0 ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-200">
                    Aún no tienes segmentos. Ve a <strong>Segmentos</strong> y crea uno antes de armar una campaña.
                </div>
            ) : (
                <form onSubmit={submit} className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-violet-500" />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">Nueva campaña</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1.5 block">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Segmento</span>
                            <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className={inputCls}>
                                {segments.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.cachedCount} clientes)
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5 block">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Canal</span>
                            <div className="flex gap-2">
                                {(["whatsapp", "email"] as Channel[]).map((c) => {
                                    const Icon = CHANNEL_ICON[c]
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setChannel(c)}
                                            className={cn(
                                                "flex-1 inline-flex items-center justify-center gap-1.5 px-3 h-10 rounded-md text-sm font-semibold border transition-colors",
                                                channel === c
                                                    ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                                                    : "border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:border-violet-500/40",
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {c === "whatsapp" ? "WhatsApp" : "Email"}
                                        </button>
                                    )
                                })}
                            </div>
                        </label>
                    </div>

                    <label className="space-y-1.5 block">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Mensaje</span>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            placeholder="Hola {nombre}, ..."
                            className="w-full rounded-md px-3 py-2 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white"
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Disponible: {`{nombre}`} se reemplaza con el nombre del cliente.
                        </p>
                    </label>

                    {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

                    <button
                        type="submit"
                        disabled={creating}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-70"
                    >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Crear como borrador
                    </button>
                </form>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                    Campañas ({campaigns.length})
                </h3>
                {campaigns.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                        Aún no hay campañas creadas.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-white/10">
                        {campaigns.map((c) => {
                            const ChannelIcon = CHANNEL_ICON[c.channel]
                            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.DRAFT
                            return (
                                <li key={c.id} className="py-3 flex items-start gap-3">
                                    <ChannelIcon className="h-4 w-4 text-slate-400 mt-1 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {c.segment?.name ?? "Segmento eliminado"}
                                            </p>
                                            <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-bold", badge.cls)}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                            {c.message}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            {c.recipients} destinatarios
                                            {c.sentAt && <> · enviada {new Date(c.sentAt).toLocaleString("es-PA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
                                        </p>
                                    </div>
                                    {c.status === "DRAFT" && (
                                        <button
                                            onClick={() => send(c)}
                                            disabled={busy === c.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                                        >
                                            {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                            Marcar enviada
                                        </button>
                                    )}
                                    <button
                                        onClick={() => remove(c)}
                                        disabled={busy === c.id}
                                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-500/10"
                                        aria-label="Eliminar"
                                    >
                                        {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}
