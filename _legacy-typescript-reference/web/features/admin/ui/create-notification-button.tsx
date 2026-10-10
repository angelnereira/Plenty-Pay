"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { CreateNotificationModal } from "@/features/admin/ui/create-notification-modal"

export function CreateNotificationButton() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
            >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Notificación
            </button>

            <CreateNotificationModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    )
}
