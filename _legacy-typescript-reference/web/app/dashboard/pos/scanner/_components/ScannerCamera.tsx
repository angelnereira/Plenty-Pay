'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Flashlight, FlashlightOff, Wifi, WifiOff, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type ScanFeedback = 'idle' | 'success' | 'error';

interface ScannerCameraProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  onStopRequest?: () => void;
  feedback: ScanFeedback;
  isActive: boolean;
  hasPermission: boolean | null;
}

export function ScannerCamera({
  onVideoReady,
  feedback,
  isActive,
  hasPermission,
}: ScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      onVideoReady(videoRef.current);
    }
  }, [onVideoReady]);

  // Detect torch support after video starts
  useEffect(() => {
    if (!isActive) return;
    const video = videoRef.current;
    if (!video) return;

    const checkTorch = () => {
      const stream = video.srcObject as MediaStream | null;
      if (!stream) return;
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchSupported(!!capabilities?.torch);
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
      await (track as MediaStreamTrack & { applyConstraints: (c: MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> }) => Promise<void> }).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchEnabled(next);
    } catch {
      // torch not supported
    }
  }, [torchEnabled]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Flash feedback overlay */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-150 pointer-events-none',
          feedback === 'success' && 'bg-green-400/30 opacity-100',
          feedback === 'error' && 'bg-red-400/30 opacity-100',
          feedback === 'idle' && 'opacity-0'
        )}
      />

      {/* Scan frame */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={cn(
            'w-64 h-48 rounded-2xl border-2 relative transition-colors duration-150',
            feedback === 'success' ? 'border-green-400' : feedback === 'error' ? 'border-red-400' : 'border-white/70'
          )}
        >
          {/* Corner marks */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-violet-400 -mt-0.5 -ml-0.5 rounded-tl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-violet-400 -mt-0.5 -mr-0.5 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-violet-400 -mb-0.5 -ml-0.5 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-violet-400 -mb-0.5 -mr-0.5 rounded-br" />

          {/* Scan line animation */}
          {isActive && (
            <div className="absolute inset-x-2 top-1/2 h-0.5 bg-violet-400/80 animate-pulse" />
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
        {isActive ? (
          <>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white text-xs font-medium">Escaneando</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-white text-xs font-medium">Detenido</span>
          </>
        )}
      </div>

      {/* Torch button */}
      {torchSupported && (
        <button
          onClick={toggleTorch}
          className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-full p-2.5 text-white"
        >
          {torchEnabled ? (
            <FlashlightOff className="h-5 w-5" />
          ) : (
            <Flashlight className="h-5 w-5" />
          )}
        </button>
      )}

      {/* Permission denied overlay */}
      {hasPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white text-center px-6 gap-3">
          <WifiOff className="h-12 w-12 text-red-400" />
          <p className="font-semibold">Acceso a cámara denegado</p>
          <p className="text-sm text-white/70">Otorgue permiso de cámara en la configuración del navegador</p>
        </div>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-4 inset-x-0 text-center">
        <p className="text-white/60 text-xs flex items-center justify-center gap-1">
          <ScanLine className="h-3 w-3" />
          Apunte al código de barras
        </p>
      </div>
    </div>
  );
}
