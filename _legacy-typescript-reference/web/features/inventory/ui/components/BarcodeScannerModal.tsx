'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { ScannerCamera, type ScanFeedback } from '@/app/dashboard/pos/scanner/_components/ScannerCamera'
import { useContinuousScanner } from '@/lib/pos/scanner/use-continuous-scanner'
import { playErrorBeep, playSuccessBeep } from '@/lib/pos/scanner/audio-feedback'

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (code: string) => void
  title?: string
  hint?: string
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onScan,
  title = 'Escanear código',
  hint = 'Apunta la cámara al código de barras',
}: BarcodeScannerModalProps) {
  const [feedback, setFeedback] = useState<ScanFeedback>('idle')
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handledRef = useRef(false)

  const showFeedback = useCallback((type: ScanFeedback) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    setFeedback(type)
    feedbackTimerRef.current = setTimeout(() => setFeedback('idle'), 400)
  }, [])

  const handleScan = useCallback(
    (code: string) => {
      if (handledRef.current) return
      handledRef.current = true
      playSuccessBeep()
      showFeedback('success')
      onScan(code)
      // Close shortly after, giving the success flash time to render
      setTimeout(() => onOpenChange(false), 250)
    },
    [onScan, onOpenChange, showFeedback]
  )

  const handleError = useCallback(() => {
    playErrorBeep()
    showFeedback('error')
  }, [showFeedback])

  const { startScanning, stopScanning, isActive, hasPermission } = useContinuousScanner({
    onScan: handleScan,
    onError: handleError,
  })

  // Reset handled flag whenever the modal is (re)opened
  useEffect(() => {
    if (open) {
      handledRef.current = false
    } else {
      stopScanning()
    }
  }, [open, stopScanning])

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      if (open) startScanning(video)
    },
    [open, startScanning]
  )

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex flex-col bg-black"
    >
      <header className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-[11px] text-white/60">{hint}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar"
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 min-h-0 relative">
        <ScannerCamera
          onVideoReady={handleVideoReady}
          feedback={feedback}
          isActive={isActive}
          hasPermission={hasPermission}
        />
      </div>

      <footer className="px-4 py-3 bg-black/80 text-center">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 transition-colors"
        >
          Cancelar
        </button>
      </footer>
    </div>
  )
}
