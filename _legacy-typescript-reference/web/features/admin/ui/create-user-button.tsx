"use client"

import { useState } from "react"
import { UserPlus } from "lucide-react"
import { CreateUserModal } from "./create-user-modal"

interface CreateUserButtonProps {
  organizations: { id: string; name: string; ruc: string | null }[]
}

export function CreateUserButton({ organizations }: CreateUserButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <UserPlus className="h-5 w-5 mr-2" />
        Registrar Cliente
      </button>

      <CreateUserModal
        organizations={organizations}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

