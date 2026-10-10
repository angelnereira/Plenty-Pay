"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@shared/ui/dialog"
import { Button } from "@shared/ui/button"
import { Textarea } from "@shared/ui/textarea"
import { Input } from "@shared/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@shared/ui/select"
import { LifeBuoy, Send, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

export function SupportModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        subject: "",
        description: "",
        category: "TECHNICAL",
        priority: "MEDIUM"
    })

    // Escuchar evento global de fallo para abrir el modal automáticamente
    useEffect(() => {
        const handleGlobalError = (event: any) => {
            // Si el error tiene metadatos de "soporte", abrir modal
            if (event.detail?.triggerSupport) {
                setIsOpen(true)
                if (event.detail.error) {
                    setFormData(prev => ({
                        ...prev,
                        subject: `Error Automático: ${event.detail.error.message || 'Fallo de sistema'}`,
                        description: `Se detectó un error en: ${window.location.href}\n\nStack Trace:\n${event.detail.error.stack || 'No disponible'}`
                    }))
                }
            }
        }

        window.addEventListener('plentypay-support-trigger', (handleGlobalError as EventListener))
        return () => window.removeEventListener('plentypay-support-trigger', (handleGlobalError as EventListener))
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const res = await fetch("/api/support/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    browserInfo: navigator.userAgent,
                    urlPath: window.location.pathname
                })
            })

            const data = await res.json()
            if (data.success) {
                toast.success("Ticket de soporte creado. Nuestro equipo lo revisará pronto.")
                setIsOpen(false)
                setFormData({ subject: "", description: "", category: "TECHNICAL", priority: "MEDIUM" })
            } else {
                toast.error(data.error || "Fallo al crear el ticket")
            }
        } catch (e) {
            toast.error("Error de conexión al servidor de soporte")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            {/* Botón Flotante de Soporte */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 bg-black hover:bg-zinc-800 text-white border border-zinc-700 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                title="Soporte Técnico"
            >
                <LifeBuoy className="h-6 w-6" />
            </button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden p-0">
                    <div className="bg-zinc-950 p-6 text-white relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <LifeBuoy className="h-24 w-24" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                                <AlertCircle className="h-6 w-6 text-yellow-500" />
                                Centro de Soporte
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 font-medium">
                                Reporta un fallo o solicita asistencia técnica. Generaremos un ticket automático.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoría</label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v: string) => setFormData({ ...formData, category: v })}
                                >
                                    <SelectTrigger className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-xl">
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                        <SelectItem value="TECHNICAL">Fallo Técnico</SelectItem>
                                        <SelectItem value="BILLING">Facturación</SelectItem>
                                        <SelectItem value="FEATURE_REQUEST">Sugerencia</SelectItem>
                                        <SelectItem value="BUG">Error (Bug)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Prioridad</label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(v: string) => setFormData({ ...formData, priority: v })}
                                >
                                    <SelectTrigger className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-xl">
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
                                        <SelectItem value="LOW">Baja</SelectItem>
                                        <SelectItem value="MEDIUM">Media</SelectItem>
                                        <SelectItem value="HIGH">Alta</SelectItem>
                                        <SelectItem value="URGENT">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Asunto</label>
                            <Input
                                required
                                placeholder="Ej: Problema al emitir factura..."
                                value={formData.subject}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, subject: e.target.value })}
                                className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-xl h-12"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Descripción del Problema</label>
                            <Textarea
                                required
                                placeholder="Por favor detalla qué estabas haciendo y qué falló..."
                                value={formData.description}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                                className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-xl min-h-[120px]"
                            />
                        </div>

                        <DialogFooter className="pt-4 gap-2 sm:gap-0">
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-12 bg-black text-white hover:bg-zinc-800 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-zinc-200 dark:shadow-none"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Enviar Ticket
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    )
}
