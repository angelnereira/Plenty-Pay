"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { EnhancedLoginFormContent } from "./enhanced-login-form-content"

export function LoginFormWrapper() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-100">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        </div>
      </div>
    }>
      <EnhancedLoginFormContent />
    </Suspense>
  )
}

