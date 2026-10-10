"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Loader2 } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"

interface ApproveButtonProps {
    clientId: string
    clientName: string
    requestedModules: string[]
}

export function ApproveButton({ clientId, clientName, requestedModules }: ApproveButtonProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)

    // State for module selection (defaults to requested modules)
    const [modules, setModules] = useState({
        inventory: requestedModules.includes("inventory"),
        pos: requestedModules.includes("pos"),
        payday: requestedModules.includes("payday"),
        logistics: requestedModules.includes("logistics"),
    })

    const handleApprove = async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/admin/approvals/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    modules
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Error al aprobar organización")
            }

            toast.success(`Organización ${clientName} aprobada correctamente`)
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
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Check className="mr-2 h-4 w-4" />
                    Aprobar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Aprobar Organización: {clientName}</DialogTitle>
                    <DialogDescription>
                        Confirma los módulos que se activarán para esta organización.
                        El usuario recibirá un correo de notificación.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="inventory"
                            checked={modules.inventory}
                            onCheckedChange={(checked) => setModules({ ...modules, inventory: !!checked })}
                        />
                        <Label htmlFor="inventory">Módulo de Inventario (Pro)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="pos"
                            checked={modules.pos}
                            onCheckedChange={(checked) => setModules({ ...modules, pos: !!checked })}
                        />
                        <Label htmlFor="pos">Punto de Venta (POS)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="payday"
                            checked={modules.payday}
                            onCheckedChange={(checked) => setModules({ ...modules, payday: !!checked })}
                        />
                        <Label htmlFor="payday">Planilla (Payday)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="logistics"
                            checked={modules.logistics}
                            onCheckedChange={(checked) => setModules({ ...modules, logistics: !!checked })}
                        />
                        <Label htmlFor="logistics">Logística</Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleApprove}
                        disabled={isLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Aprobando...
                            </>
                        ) : (
                            "Confirmar Aprobación"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function RejectButton({ clientId, clientName }: { clientId: string; clientName: string }) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const handleReject = async () => {
        const reason = prompt(`Motivo del rechazo para ${clientName}:`)
        if (!reason || reason.trim().length < 3) {
            if (reason !== null) toast.error("El motivo debe tener al menos 3 caracteres")
            return
        }

        setIsLoading(true)
        try {
            const response = await fetch("/api/admin/approvals/reject", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, reason: reason.trim() }),
            })

            if (!response.ok) throw new Error("Error al rechazar")

            toast.success("Organización rechazada")
            router.refresh()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleReject} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
            Rechazar
        </Button>
    )
}
