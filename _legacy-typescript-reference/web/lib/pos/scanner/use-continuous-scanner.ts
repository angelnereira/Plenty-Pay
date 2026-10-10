'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Lazy import to avoid SSR issues with @zxing/browser
type ScannerControls = { stop: () => void };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ZxingImports = unknown; // placeholder for lazy imports

export interface UseContinuousScannerOptions {
  onScan: (barcode: string) => void;
  onError?: (error: Error) => void;
  cooldownMs?: number;
}

export interface UseContinuousScannerResult {
  startScanning: (videoElement: HTMLVideoElement) => Promise<void>;
  stopScanning: () => void;
  isActive: boolean;
  hasPermission: boolean | null;
}

const SUPPORTED_FORMATS_NAMES = [
  'EAN_13',
  'EAN_8',
  'CODE_128',
  'CODE_39',
  'QR_CODE',
  'UPC_A',
  'UPC_E',
];

export function useContinuousScanner({
  onScan,
  onError,
  cooldownMs = 1500,
}: UseContinuousScannerOptions): UseContinuousScannerResult {
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const controlsRef = useRef<ScannerControls | null>(null);
  const lastBarcodeRef = useRef<string | null>(null);
  const lastTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const startScanning = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      // Lazy-load to avoid SSR crash
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');

      const formatValues = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
      ];

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formatValues);

      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 });

      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoElement,
        (result, error) => {
          if (!result) return;
          const text = result.getText();
          const now = Date.now();

          // Cooldown: ignore same barcode within cooldownMs
          if (text === lastBarcodeRef.current && now - lastTimeRef.current < cooldownMs) {
            return;
          }

          lastBarcodeRef.current = text;
          lastTimeRef.current = now;
          onScanRef.current(text);
        }
      );

      controlsRef.current = controls;
      setIsActive(true);
      setHasPermission(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.message.toLowerCase().includes('permission') || error.name === 'NotAllowedError') {
        setHasPermission(false);
      }
      onErrorRef.current?.(error);
    }
  }, [cooldownMs]);

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsActive(false);
    lastBarcodeRef.current = null;
    lastTimeRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  return { startScanning, stopScanning, isActive, hasPermission };
}
