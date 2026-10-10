"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Camera, X, Loader2, RotateCcw, Zap, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImageUploadProps {
    value: string;
    onChange: (value: string) => void;
    onRemove: () => void;
}

export function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [torchOn, setTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Upload via API route (not server action) ────────────────────────────
    const uploadImage = useCallback(async (base64: string) => {
        setIsUploading(true);
        try {
            const res = await fetch("/api/upload/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64 }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || "Error al subir la imagen");
            }

            onChange(data.publicId);
            toast.success("Imagen subida correctamente");
            setPreview(null);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "No se pudo subir la imagen";
            console.error("[ImageUpload]", msg);
            toast.error(msg);
        } finally {
            setIsUploading(false);
        }
    }, [onChange]);

    // ─── File handling ───────────────────────────────────────────────────────
    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        if (!file.type.startsWith("image/")) {
            toast.error("Solo se permiten imágenes (JPG, PNG, WEBP)");
            return;
        }
        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("La imagen no puede superar 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            uploadImage(base64);
        };
        reader.onerror = () => toast.error("Error al leer el archivo");
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again
        e.target.value = "";
    }, [uploadImage]);

    // ─── Drag & drop ─────────────────────────────────────────────────────────
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("La imagen no puede superar 5MB");
                return;
            }
            const reader = new FileReader();
            reader.onload = () => uploadImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    }, [uploadImage]);

    // ─── Camera functions ────────────────────────────────────────────────────
    const startCamera = useCallback(async (facing: "environment" | "user" = facingMode) => {
        // Stop existing stream first
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        setCameraReady(false);
        setIsCameraOpen(true);

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facing },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            streamRef.current = mediaStream;

            // Check torch capability
            const track = mediaStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities?.() as { torch?: boolean } | undefined;
            setHasTorch(!!capabilities?.torch);

            // Wait for video element to be in DOM, then assign stream
            requestAnimationFrame(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play().then(() => {
                            setCameraReady(true);
                        }).catch(err => {
                            console.error("Play failed:", err);
                            setCameraReady(true); // Still show UI
                        });
                    };
                }
            });
        } catch (error) {
            console.error("Camera error:", error);
            toast.error("No se pudo acceder a la cámara. Verifica los permisos en tu navegador.");
            setIsCameraOpen(false);
        }
    }, [facingMode]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraReady(false);
        setIsCameraOpen(false);
        setPreview(null);
        setTorchOn(false);
    }, []);

    const toggleCamera = useCallback(() => {
        const newFacing = facingMode === "environment" ? "user" : "environment";
        setFacingMode(newFacing);
        startCamera(newFacing);
    }, [facingMode, startCamera]);

    const toggleTorch = useCallback(async () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        try {
            await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
            setTorchOn(!torchOn);
        } catch {
            toast.error("No se pudo controlar el flash");
        }
    }, [torchOn]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || videoRef.current.videoWidth === 0) {
            toast.error("La cámara no está lista. Espera un momento.");
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPreview(dataUrl);
    }, []);

    const confirmCapture = useCallback(() => {
        if (!preview) return;
        stopCamera();
        uploadImage(preview);
    }, [preview, stopCamera, uploadImage]);

    const retakePhoto = useCallback(() => {
        setPreview(null);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // ─── Camera Modal (full-screen overlay for mobile) ───────────────────────
    if (isCameraOpen) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/70 to-transparent">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={stopCamera}
                            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <span className="text-white text-sm font-medium">
                            {preview ? "Vista previa" : "Capturar Foto"}
                        </span>
                        <div className="flex gap-2">
                            {hasTorch && !preview && (
                                <button
                                    onClick={toggleTorch}
                                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                                >
                                    {torchOn ? <Zap className="h-5 w-5 text-yellow-400" /> : <ZapOff className="h-5 w-5" />}
                                </button>
                            )}
                            {!preview && (
                                <button
                                    onClick={toggleCamera}
                                    className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                                >
                                    <RotateCcw className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Video / Preview */}
                <div className="flex-1 flex items-center justify-center bg-black overflow-hidden">
                    {preview ? (
                        <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {!cameraReady && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black">
                                    <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                                </div>
                            )}
                        </>
                    )}
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-white" />
                            <p className="text-white font-medium text-sm">Subiendo imagen...</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="p-6 bg-black flex items-center justify-center gap-8">
                    {preview ? (
                        <>
                            <button
                                onClick={retakePhoto}
                                className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
                            >
                                <RotateCcw className="h-6 w-6" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Repetir</span>
                            </button>
                            <button
                                onClick={confirmCapture}
                                disabled={isUploading}
                                className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 flex items-center justify-center shadow-lg transition-colors"
                            >
                                {isUploading ? (
                                    <Loader2 className="h-7 w-7 animate-spin text-white" />
                                ) : (
                                    <Upload className="h-7 w-7 text-white" />
                                )}
                            </button>
                            <div className="w-12" />
                        </>
                    ) : (
                        <>
                            <button
                                onClick={stopCamera}
                                className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors"
                            >
                                <X className="h-6 w-6" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Cancelar</span>
                            </button>
                            <button
                                onClick={capturePhoto}
                                disabled={!cameraReady || isUploading}
                                className="h-20 w-20 rounded-full bg-white hover:bg-white/90 disabled:bg-gray-600 p-0 shadow-2xl relative group transition-colors"
                            >
                                <div className="absolute inset-2 border-4 border-black rounded-full" />
                                <Camera className="h-8 w-8 text-black mx-auto group-active:scale-90 transition-transform" />
                            </button>
                            <div className="w-12" />
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ─── Default Upload UI ───────────────────────────────────────────────────
    return (
        <div className="w-full">
            <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
            />

            {/* Drop zone wrapper */}
            <div
                className={`flex flex-col md:flex-row items-center justify-center gap-4 w-full p-2 rounded-xl transition-colors ${
                    isDragOver ? "bg-violet-50 dark:bg-violet-900/20 ring-2 ring-violet-400" : ""
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
            >
                <Button
                    type="button"
                    variant="outline"
                    className="w-full md:w-auto flex items-center gap-2 h-12 px-6 rounded-xl border-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-200 transition-all group"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                    ) : (
                        <Upload className="h-5 w-5 text-violet-600 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="font-bold">
                        {isUploading ? "Subiendo..." : "Importar Foto"}
                    </span>
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full md:w-auto flex items-center gap-2 h-12 px-6 rounded-xl border-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 transition-all group"
                    onClick={() => startCamera()}
                    disabled={isUploading}
                >
                    <Camera className="h-5 w-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span className="font-bold">Tomar Foto</span>
                </Button>
            </div>

            {isDragOver && (
                <p className="text-center text-xs text-violet-600 font-medium mt-2 animate-pulse">
                    Suelta la imagen aquí
                </p>
            )}
        </div>
    );
}
