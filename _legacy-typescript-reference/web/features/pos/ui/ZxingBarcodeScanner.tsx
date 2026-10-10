'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { X, Flashlight, FlashlightOff } from 'lucide-react';
import { Button } from '@shared/ui/button';
import { useContinuousScanner } from '@/lib/pos/scanner/use-continuous-scanner';
import './pos-mobile.css';

interface ZxingBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function ZxingBarcodeScanner({ onScan, onClose }: ZxingBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle');
  const feedbackRef = useRef<NodeJS.Timeout | null>(null);

  const handleScan = useCallback((code: string) => {
    if (feedbackRef.current) clearTimeout(feedbackRef.current);
    setFeedback('success');
    feedbackRef.current = setTimeout(() => setFeedback('idle'), 300);
    onScan(code);
  }, [onScan]);

  const { startScanning, stopScanning, isActive, hasPermission } = useContinuousScanner({
    onScan: handleScan,
    cooldownMs: 1500,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    startScanning(video);

    return () => {
      stopScanning();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect torch and capture stream reference
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const checkTorch = () => {
      const stream = video.srcObject as MediaStream | null;
      if (!stream) return;
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!caps?.torch);
    };

    video.addEventListener('loadeddata', checkTorch);
    return () => video.removeEventListener('loadeddata', checkTorch);
  }, [isActive]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const next = !torchEnabled;
    try {
      await (track as MediaStreamTrack & {
        applyConstraints: (c: { advanced?: Array<{ torch?: boolean }> }) => Promise<void>;
      }).applyConstraints({ advanced: [{ torch: next }] });
      setTorchEnabled(next);
    } catch {
      // torch not supported on this device
    }
  }, [torchEnabled]);

  return (
    <div className="scanner-overlay flex flex-col items-center justify-center">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white z-50 rounded-full bg-black/40"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Torch button */}
      {torchSupported && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 text-white z-50 rounded-full bg-black/40"
          onClick={toggleTorch}
        >
          {torchEnabled ? (
            <FlashlightOff className="h-5 w-5" />
          ) : (
            <Flashlight className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Flash feedback overlay */}
      {feedback !== 'idle' && (
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${
            feedback === 'success' ? 'bg-green-400/25' : 'bg-red-400/25'
          }`}
        />
      )}

      {/* Scanner frame */}
      <div className="relative z-10">
        <div className="scanner-guide">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-violet-400 -mt-0.5 -ml-0.5 rounded-tl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-violet-400 -mt-0.5 -mr-0.5 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-violet-400 -mb-0.5 -ml-0.5 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-violet-400 -mb-0.5 -mr-0.5 rounded-br" />
          <div className="scanner-laser" />
        </div>
      </div>

      {/* Status / permission */}
      {hasPermission === false ? (
        <div className="absolute bottom-20 bg-red-500 text-white p-4 rounded-lg mx-4 text-center z-10">
          Acceso a cámara denegado. Otorgue permisos en su navegador.
        </div>
      ) : (
        <div className="absolute bottom-10 text-white/70 text-sm font-medium z-10">
          {isActive ? 'Apunte la cámara al código de barras' : 'Iniciando cámara...'}
        </div>
      )}
    </div>
  );
}
