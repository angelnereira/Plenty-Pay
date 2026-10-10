"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface RejectButtonProps {
    clientId: string
    clientName: string
}

export function RejectButton({ clientId, clientName }: RejectButtonProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [reason, setReason] = useState("")

    const handleReject = async () => {
        if (!reason.trim()) {
            toast.error("Por favor ingresa una razón")
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch("/api/admin/approvals/reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    reason
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Error al rechazar organización")
            }

            toast.success(`Organización ${clientName} rechazada`)
            setIsOpen(false)
            router.refresh()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                    <X className="mr-2 h-4 w-4" />
                    Rechazar
                </Button>
            </DialogTrigger>
            <DialogContent className="border-red-200">
                <DialogHeader>
                    <DialogTitle className="text-red-700">Rechazar Organización: {clientName}</DialogTitle>
                    <DialogDescription>
                        Esta acción marcará la organización como rechazada. El usuario será notificado.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Razón del rechazo</Label>
                        <Textarea
                            id="reason"
                            placeholder="Ej: Documentación incompleta, RUC inválido..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleReject}
                        disabled={isLoading}
                        variant="destructive"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Rechazando...
                            </>
                        ) : (
                            "Confirmar Rechazo"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
