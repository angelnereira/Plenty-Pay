'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Package, Lock, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { ProductList } from './ProductList'
import { PasswordChallenge } from '@/features/auth/components/PasswordChallenge'

interface Product {
  id: string
  sku: string | null
  barcode: string | null
  name: string
  brand: string | null
  currentStock: any
  salePrice: any
  unitType: string
  image: string | null
}

interface RecentProductsSectionProps {
  products: Product[]
  isReadOnly?: boolean
}

export function RecentProductsSection({ products, isReadOnly = true }: RecentProductsSectionProps) {
  const [isLocked, setIsLocked] = useState(isReadOnly)
  const [showUnlockChallenge, setShowUnlockChallenge] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-400" />
          Productos Recientes
        </h2>
        <div className="flex items-center gap-3">
          {isReadOnly &&
            (isLocked ? (
              <button
                type="button"
                onClick={() => setShowUnlockChallenge(true)}
                aria-label="Modo Lectura — clic para editar"
                title="Modo Lectura — clic para editar"
                className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsLocked(true)
                  toast.success('Modo Lectura activado. Edición bloqueada.', { duration: 2500 })
                }}
                aria-label="Modo Edición — clic para bloquear"
                title="Modo Edición — clic para bloquear"
                className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 dark:bg-green-900/10 dark:text-green-400 dark:border-green-800 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            ))}
          <Link
            href="/dashboard/inventory/productos"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            Ver todos
          </Link>
        </div>
      </div>

      <ProductList products={products} isLocked={isLocked} />

      <PasswordChallenge
        open={showUnlockChallenge}
        onOpenChange={setShowUnlockChallenge}
        onSuccess={() => {
          setIsLocked(false)
          toast.success('Modo Edición activado.', { duration: 2500 })
        }}
      />
    </div>
  )
}
