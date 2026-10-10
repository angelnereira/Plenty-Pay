
'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs';
import { Button } from '@shared/ui/button';
import { Upload, FileSpreadsheet, FileCode, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseInvoiceFile } from '@/app/actions/invoice/parse-invoice-file.action';
import type { DocumentoElectronico } from '@/features/hka/model/types/types';

// Local type for input file types
type InputFileType = 'xlsx' | 'xml' | 'csv' | 'json' | 'xls';

// Alias for backwards compatibility
type EnviarFacturaRequest = DocumentoElectronico;

interface ImportInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDataParsed: (data: EnviarFacturaRequest) => void;
}

export function ImportInvoiceModal({ isOpen, onClose, onDataParsed }: ImportInvoiceModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('excel');

    const onDrop = async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        let type: InputFileType = 'xlsx';
        if (activeTab === 'excel') type = file.name.endsWith('.xls') ? 'xls' : 'xlsx';
        else if (activeTab === 'xml') type = 'xml';
        else if (activeTab === 'text') type = 'json'; // Asumiendo JSON por ahora

        await processFile(file, type);
    };

    const processFile = async (file: File, type: InputFileType) => {
        setIsProcessing(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const result = await parseInvoiceFile(formData);
            if (result.success && result.data) {
                toast.success('Archivo procesado correctamente');
                onDataParsed(result.data);
                onClose();
            } else {
                toast.error(result.error || 'Error al procesar archivo');
            }
        } catch (error) {
            toast.error('Error inesperado');
        } finally {
            setIsProcessing(false);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: activeTab === 'excel'
            ? { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] }
            : activeTab === 'xml'
                ? { 'text/xml': ['.xml'] }
                : { 'application/json': ['.json'], 'text/plain': ['.txt'] },
        maxFiles: 1
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Importar Factura</DialogTitle>
                    <DialogDescription>
                        Sube un archivo para generar una factura automáticamente.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="excel" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="excel">Excel</TabsTrigger>
                        <TabsTrigger value="xml">XML</TabsTrigger>
                        <TabsTrigger value="text">Texto / JSON</TabsTrigger>
                    </TabsList>

                    <div className="mt-6">
                        <div
                            {...getRootProps()}
                            className={`
                                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                                ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'}
                            `}
                        >
                            <input {...getInputProps()} />

                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                                    {activeTab === 'excel' && <FileSpreadsheet className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />}
                                    {activeTab === 'xml' && <FileCode className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />}
                                    {activeTab === 'text' && <FileText className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {isDragActive ? "Suelta el archivo aquí" : "Arrastra un archivo o haz click para seleccionar"}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {activeTab === 'excel' ? 'Soporta .xlsx, .xls' : activeTab === 'xml' ? 'Soporta .xml (UBL/HKA)' : 'Soporta .json, .txt'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Tabs>

                <DialogFooter className="sm:justify-start">
                    <div className="text-xs text-gray-500 italic">
                        * El archivo será validado antes de procesar
                    </div>
                </DialogFooter>

                {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-gray-950/80 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                            <p className="text-sm font-medium">Procesando archivo...</p>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

