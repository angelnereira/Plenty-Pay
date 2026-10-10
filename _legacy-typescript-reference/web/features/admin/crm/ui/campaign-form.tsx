"use client"

import { useState, useEffect } from "react"
import { Send, Loader2, Users, Mail, Info, ChevronDown, Check, X, UserSearch } from "lucide-react"
import { toast } from "sonner"
import { CRM_PRESETS } from "@/lib/email-templates/crm-presets"

const PLAN_OPTIONS = [
    { id: "CRECIMIENTO", label: "Crecimiento" },
    { id: "PROFESIONAL", label: "Profesional" },
    { id: "EMPRESARIAL", label: "Empresarial" },
    { id: "ENTERPRISE", label: "Enterprise" },
]

interface DbUser {
    id: string
    name: string
    email: string
    client?: {
        name: string
        planType: string
    }
}

export function CampaignForm({ onComplete }: { onComplete: () => void }) {
    const [isLoading, setIsLoading] = useState(false)
    const [recipientMode, setRecipientMode] = useState<"PLAN" | "SPECIFIC" | "MANUAL">("PLAN")
    const [dbUsers, setDbUsers] = useState<DbUser[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    
    const [formData, setFormData] = useState({
        subject: "",
        content: "",
        targetPlans: [] as string[],
        targetUserIds: [] as string[],
        targetEmails: [] as string[],
        fromEmail: ""
    })

    // Cargar usuarios cuando se selecciona el modo específico
    useEffect(() => {
        if (recipientMode === "SPECIFIC" && dbUsers.length === 0) {
            fetch("/api/admin/crm/users")
                .then(res => res.json())
                .then(data => setDbUsers(data))
                .catch(() => toast.error("Error al cargar lista de usuarios"))
        }
    }, [recipientMode, dbUsers.length])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const hasRecipients = 
            (recipientMode === "PLAN" && (formData.targetPlans.length > 0 || confirm("¿Enviar a TODOS los usuarios?"))) ||
            (recipientMode === "SPECIFIC" && formData.targetUserIds.length > 0) ||
            (recipientMode === "MANUAL" && formData.targetEmails.length > 0)

        if (!hasRecipients) {
            if (recipientMode !== "PLAN") {
                toast.error("Debes seleccionar al menos un destinatario")
                return
            }
        }

        setIsLoading(true)
        try {
            const res = await fetch("/api/admin/crm/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    // Filter arrays based on current mode to avoid sending unused data
                    targetPlans: recipientMode === "PLAN" ? formData.targetPlans : [],
                    targetUserIds: recipientMode === "SPECIFIC" ? formData.targetUserIds : [],
                    targetEmails: recipientMode === "MANUAL" ? formData.targetEmails : []
                })
            })
            const data = await res.json()

            if (data.success) {
                toast.success(`Campaña lanzada con éxito (${data.data.totalSent} enviados)`)
                setFormData({ 
                    subject: "", 
                    content: "", 
                    targetPlans: [], 
                    targetUserIds: [], 
                    targetEmails: [],
                    fromEmail: ""
                })
                onComplete()
            } else {
                toast.error(data.error || "Error al enviar")
            }
        } catch (e) {
            toast.error("Error de conexión")
        } finally {
            setIsLoading(false)
        }
    }

    const togglePlan = (planId: string) => {
        setFormData(prev => ({
            ...prev,
            targetPlans: prev.targetPlans.includes(planId)
                ? prev.targetPlans.filter(id => id !== planId)
                : [...prev.targetPlans, planId]
        }))
    }

    const toggleUser = (userId: string) => {
        setFormData(prev => ({
            ...prev,
            targetUserIds: prev.targetUserIds.includes(userId)
                ? prev.targetUserIds.filter(id => id !== userId)
                : [...prev.targetUserIds, userId]
        }))
    }

    const applyPreset = (presetId: string) => {
        const preset = CRM_PRESETS.find(p => p.id === presetId)
        if (preset) {
            setFormData(prev => ({
                ...prev,
                subject: preset.subject,
                content: preset.content
            }))
            toast.success("Plantilla aplicada")
        }
    }

    const filteredUsers = dbUsers.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.client?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                        <Send className="h-5 w-5 text-violet-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Campaña Profesional</h3>
                </div>

                <div className="relative group">
                    <button type="button" className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold hover:border-violet-500 transition-all">
                        Cargar Plantilla <ChevronDown className="h-3 w-3" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover:block z-50 overflow-hidden">
                        {CRM_PRESETS.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p.id)}
                                className="w-full px-4 py-3 text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-900/10 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                            >
                                <span className="font-bold block">{p.label}</span>
                                <span className="text-gray-400 block truncate mt-1">{p.subject}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Remitente Opcional */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email Remitente (Opcional)</label>
                    <input
                        type="email"
                        value={formData.fromEmail}
                        onChange={e => setFormData({ ...formData, fromEmail: e.target.value })}
                        placeholder="Ej: marketing@plentypay.com (Debe estar verificado en Resend)"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm"
                    />
                </div>

                {/* Asunto */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Asunto</label>
                    <input
                        type="text"
                        required
                        value={formData.subject}
                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Ej: ¡Nuevas funciones disponibles en PlentyPay!"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all text-sm font-bold"
                    />
                </div>

                {/* Modo de Destinatarios */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Segmentación de Destinatarios</label>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl mb-4">
                        {(["PLAN", "SPECIFIC", "MANUAL"] as const).map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setRecipientMode(mode)}
                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                    recipientMode === mode 
                                    ? "bg-white dark:bg-gray-800 text-violet-600 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                {mode === "PLAN" ? "Por Plan" : mode === "SPECIFIC" ? "Usuarios" : "Lista Manual"}
                            </button>
                        ))}
                    </div>

                    {recipientMode === "PLAN" && (
                        <div className="flex flex-wrap gap-2">
                            {PLAN_OPTIONS.map(plan => (
                                <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => togglePlan(plan.id)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${formData.targetPlans.includes(plan.id)
                                        ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200"
                                        : "bg-gray-50 dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-violet-400"
                                        }`}
                                >
                                    {plan.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {recipientMode === "SPECIFIC" && (
                        <div className="space-y-3">
                            <div className="relative">
                                <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nombre, correo o empresa..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-violet-500"
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto scrollbar-hide border border-gray-100 dark:border-gray-700 rounded-xl divide-y divide-gray-50 dark:divide-gray-800">
                                {filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => toggleUser(user.id)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-left"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{user.email} • {user.client?.name}</p>
                                        </div>
                                        <div className={`h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                                            formData.targetUserIds.includes(user.id) ? "bg-violet-600 border-violet-600" : "border-gray-300"
                                        }`}>
                                            {formData.targetUserIds.includes(user.id) && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-violet-600 font-bold">{formData.targetUserIds.length} usuarios seleccionados</p>
                        </div>
                    )}

                    {recipientMode === "MANUAL" && (
                        <textarea
                            rows={3}
                            placeholder="Introduce los correos separados por comas o saltos de línea..."
                            onChange={e => setFormData({ ...formData, targetEmails: e.target.value.split(/[\s,]+/).filter(Boolean) })}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-xs font-mono"
                        />
                    )}
                </div>

                {/* Contenido HTML */}
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Cuerpo del Mensaje (HTML)</label>
                    <textarea
                        required
                        rows={10}
                        value={formData.content}
                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Escribe aquí... Variables: {name}, {company}, {plan}, {date}, {year}"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none transition-all font-mono text-xs shadow-inner"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-violet-600 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-xl shadow-violet-200 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Procesando...
                    </>
                ) : (
                    <>
                        <Send className="h-5 w-5" />
                        Lanzar Campaña
                    </>
                )}
            </button>
        </form>
    )
}
