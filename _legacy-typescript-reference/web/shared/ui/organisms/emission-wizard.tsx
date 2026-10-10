/*
 * FEATURE DESHABILITADO - USO FUTURO
 *
 * Este componente EmissionWizard está deshabilitado para simplificar
 * el flujo operativo. Implementa el flujo completo de emisión masiva en 3 pasos:
 * 1. Upload: Cargar archivo Excel
 * 2. Preview: Revisar y editar datos parseados
 * 3. Emit: Emitir facturas y mostrar resultados
 *
 * Se mantendrá comentado para uso futuro.
 */

// 'use client';
// 
// import { useEffect, useState } from 'react';
// import { useEmissionStore } from '@/lib/stores/emission-store';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
// import { Button } from '@shared/ui/button';
// import { Progress } from '@shared/ui/progress';
// import { ExcelDropzone } from '@shared/ui/molecules/excel-dropzone';
// import { InvoicePreviewRow } from '@shared/ui/molecules/invoice-preview-row';
// import { StatusBadge } from '@shared/ui/atoms/status-badge';
// import {
//   Upload,
//   Eye,
//   Send,
//   ChevronLeft,
//   ChevronRight,
//   CheckCircle2,
//   AlertCircle,
//   Download,
//   FileText,
// } from 'lucide-react';
// import { cn } from '@/lib/utils';
// import { toast } from 'sonner';
// import { createInvoice } from '@/app/actions/invoice/create-invoice.action';
// import { emitInvoice } from '@/app/actions/invoice/emit-invoice.action';
// import ExcelJS from 'exceljs';
// import type { ParsedInvoiceData, ParsedInvoiceItem } from '@/lib/stores/emission-store';
// 
// /**
//  * Componente Organism: EmissionWizard
//  *
//  * Implementa el flujo completo de emisión en 3 pasos:
//  * 1. Upload: Cargar archivo Excel
//  * 2. Preview: Revisar y editar datos parseados
//  * 3. Emit: Emitir facturas y mostrar resultados
//  *
//  * Patrón: Upload -> Preview -> Commit
//  */
// export function EmissionWizard() {
//   const {
//     files,
//     currentStep,
//     emissionProgress,
//     addFile,
//     setFileParsedData,
//     setFileError,
//     updateFileStatus,
//     nextStep,
//     previousStep,
//     updateInvoiceData,
//     startEmission,
//     addEmissionResult,
//     resetEmission,
//   } = useEmissionStore();
// 
//   const [isProcessing, setIsProcessing] = useState(false);
// 
//   const currentFile = files[0]; // Por ahora solo soportamos un archivo a la vez
// 
//   // Handler: Archivo aceptado
//   const handleFileAccepted = async (file: File) => {
//     const fileId = addFile(file);
//     updateFileStatus(fileId, 'parsing', 10);
// 
//     try {
//       // Parsear Excel usando xlsx
//       const parsedData = await parseExcelFile(file);
// 
//       if (!parsedData || parsedData.length === 0) {
//         throw new Error('No se encontraron datos válidos en el archivo');
//       }
// 
//       setFileParsedData(fileId, parsedData);
//       updateFileStatus(fileId, 'ready', 100);
//       toast.success(`Archivo parseado: ${parsedData.length} facturas encontradas`);
//     } catch (error: any) {
//       setFileError(fileId, error.message);
//       toast.error(`Error al parsear archivo: ${error.message}`);
//     }
//   };
// 
//   // Handler: Emisión de facturas
//   const handleEmit = async () => {
//     if (!currentFile?.parsedData) return;
// 
//     const validInvoices = currentFile.parsedData.filter((inv) => inv.isValid);
// 
//     if (validInvoices.length === 0) {
//       toast.error('No hay facturas válidas para emitir');
//       return;
//     }
// 
//     setIsProcessing(true);
//     startEmission(validInvoices.length);
// 
//     for (let i = 0; i < validInvoices.length; i++) {
//       const invoice = validInvoices[i];
// 
//       try {
//         // 1. Crear borrador
//         // NOTA: NO enviamos taxRate porque HKA calcula el ITBMS
//         const createResult = await createInvoice({
//           clientData: {
//             ruc: invoice.clientRuc || '',
//             dv: invoice.clientDv || '',
//             razonSocial: invoice.clientName || 'Cliente',
//             tipoContribuyente: 'PERSONA_NATURAL',
//           },
//           items: invoice.items.map((item) => ({
//             description: item.description,
//             quantity: item.quantity,
//             unitPrice: item.unitPrice,
//             taxRate: 0, // HKA calculará el ITBMS
//           })),
//           paymentMethod: 'CASH',
//         });
// 
//         if (!createResult.success || !createResult.invoiceId) {
//           throw new Error(createResult.error || 'Error al crear borrador');
//         }
// 
//         // 2. Emitir a HKA
//         const emitResult = await emitInvoice({ invoiceId: createResult.invoiceId });
// 
//         if (emitResult.success) {
//           addEmissionResult({
//             rowIndex: invoice.rowIndex,
//             success: true,
//             cufe: emitResult.data?.cufe,
//             invoiceId: createResult.invoiceId,
//           });
//           toast.success(`Factura #${invoice.rowIndex + 1} emitida exitosamente`);
//         } else {
//           throw new Error(emitResult.error || 'Error al emitir');
//         }
//       } catch (error: any) {
//         addEmissionResult({
//           rowIndex: invoice.rowIndex,
//           success: false,
//           error: error.message,
//         });
//         toast.error(`Error en factura #${invoice.rowIndex + 1}: ${error.message}`);
//       }
//     }
// 
//     setIsProcessing(false);
//     toast.success('Emisión completada');
//   };
// 
//   // Verificar si se puede avanzar al siguiente paso
//   const canProceedToPreview = currentFile?.status === 'ready' && currentFile?.parsedData && currentFile.parsedData.length > 0;
//   const canProceedToEmit = currentFile?.parsedData?.some((inv) => inv.isValid) || false;
// 
//   return (
//     <div className="max-w-7xl mx-auto space-y-6">
//       {/* Stepper visual */}
//       <Card className="shadow-md">
//         <CardContent className="pt-6">
//           <div className="flex items-center justify-between relative">
//             {/* Línea conectora */}
//             <div className="absolute left-0 right-0 top-5 h-1 bg-gray-200 dark:bg-gray-700 -z-10" />
// 
//             {/* Paso 1: Upload */}
//             <Step
//               number={1}
//               title="Cargar Excel"
//               icon={Upload}
//               isActive={currentStep === 'upload'}
//               isCompleted={currentStep === 'preview' || currentStep === 'emit'}
//             />
// 
//             {/* Paso 2: Preview */}
//             <Step
//               number={2}
//               title="Revisar Datos"
//               icon={Eye}
//               isActive={currentStep === 'preview'}
//               isCompleted={currentStep === 'emit'}
//             />
// 
//             {/* Paso 3: Emit */}
//             <Step
//               number={3}
//               title="Emitir"
//               icon={Send}
//               isActive={currentStep === 'emit'}
//               isCompleted={false}
//             />
//           </div>
//         </CardContent>
//       </Card>
// 
//       {/* Contenido del paso actual */}
//       <Card className="shadow-md">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             {currentStep === 'upload' && <><Upload className="h-5 w-5" /> Paso 1: Cargar Archivo Excel</>}
//             {currentStep === 'preview' && <><Eye className="h-5 w-5" /> Paso 2: Revisar y Editar Datos</>}
//             {currentStep === 'emit' && <><Send className="h-5 w-5" /> Paso 3: Emitir Facturas</>}
//           </CardTitle>
//           <CardDescription>
//             {currentStep === 'upload' && 'Arrastra y suelta tu archivo Excel o haz clic para seleccionar'}
//             {currentStep === 'preview' && 'Revisa los datos y edita si es necesario antes de emitir'}
//             {currentStep === 'emit' && 'Emitiendo facturas electrónicas a HKA'}
//           </CardDescription>
//         </CardHeader>
//         <CardContent>
//           {currentStep === 'upload' && (
//             <div className="space-y-6">
//               <ExcelDropzone onFileAccepted={handleFileAccepted} />
// 
//               {currentFile?.status === 'parsing' && (
//                 <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
//                   <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
//                   <span className="text-sm text-blue-700 dark:text-blue-400">
//                     Parseando archivo...
//                   </span>
//                 </div>
//               )}
// 
//               {currentFile?.status === 'ready' && currentFile.parsedData && (
//                 <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
//                   <div className="flex items-center gap-2 mb-2">
//                     <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
//                     <span className="text-sm font-medium text-green-700 dark:text-green-300">
//                       Archivo procesado exitosamente
//                     </span>
//                   </div>
//                   <p className="text-sm text-green-600 dark:text-green-400">
//                     Se encontraron {currentFile.parsedData.length} facturas.{' '}
//                     {currentFile.parsedData.filter(inv => inv.isValid).length} válidas,{' '}
//                     {currentFile.parsedData.filter(inv => !inv.isValid).length} con errores.
//                   </p>
//                 </div>
//               )}
//             </div>
//           )}
// 
//           {currentStep === 'preview' && currentFile?.parsedData && (
//             <div className="space-y-4">
//               <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-sm">
//                     <thead className="bg-gray-50 dark:bg-gray-800">
//                       <tr>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">#</th>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">RUC</th>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">DV</th>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">Cliente</th>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">Descripción</th>
//                         <th className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">Cant.</th>
//                         <th className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">Precio</th>
//                         <th className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">Total</th>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">Estado</th>
//                         <th className="p-3 text-left font-medium text-gray-700 dark:text-gray-300">Acciones</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
//                       {currentFile.parsedData.map((invoice, idx) => (
//                         <InvoicePreviewRow
//                           key={idx}
//                           invoice={invoice}
//                           onUpdate={(data) => updateInvoiceData(currentFile.id, invoice.rowIndex, data)}
//                         />
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
// 
//               {/* Resumen */}
//               <div className="grid grid-cols-3 gap-4">
//                 <Card>
//                   <CardContent className="pt-4">
//                     <div className="text-center">
//                       <p className="text-2xl font-bold text-gray-900 dark:text-white">
//                         {currentFile.parsedData.length}
//                       </p>
//                       <p className="text-xs text-gray-500 dark:text-gray-400">Total facturas</p>
//                     </div>
//                   </CardContent>
//                 </Card>
//                 <Card>
//                   <CardContent className="pt-4">
//                     <div className="text-center">
//                       <p className="text-2xl font-bold text-green-600 dark:text-green-400">
//                         {currentFile.parsedData.filter(inv => inv.isValid).length}
//                       </p>
//                       <p className="text-xs text-gray-500 dark:text-gray-400">Válidas</p>
//                     </div>
//                   </CardContent>
//                 </Card>
//                 <Card>
//                   <CardContent className="pt-4">
//                     <div className="text-center">
//                       <p className="text-2xl font-bold text-red-600 dark:text-red-400">
//                         {currentFile.parsedData.filter(inv => !inv.isValid).length}
//                       </p>
//                       <p className="text-xs text-gray-500 dark:text-gray-400">Con errores</p>
//                     </div>
//                   </CardContent>
//                 </Card>
//               </div>
//             </div>
//           )}
// 
//           {currentStep === 'emit' && emissionProgress && (
//             <div className="space-y-6">
//               {/* Progreso */}
//               <div className="space-y-3">
//                 <div className="flex items-center justify-between text-sm">
//                   <span className="font-medium text-gray-700 dark:text-gray-300">
//                     Progreso de emisión
//                   </span>
//                   <span className="font-bold text-primary">
//                     {emissionProgress.processedInvoices} / {emissionProgress.totalInvoices}
//                   </span>
//                 </div>
//                 <Progress
//                   value={(emissionProgress.processedInvoices / emissionProgress.totalInvoices) * 100}
//                   className="h-3"
//                 />
//               </div>
// 
//               {/* Estadísticas */}
//               <div className="grid grid-cols-3 gap-4">
//                 <Card className="border-green-200 dark:border-green-800">
//                   <CardContent className="pt-4">
//                     <div className="flex items-center gap-2">
//                       <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
//                       <div>
//                         <p className="text-2xl font-bold text-green-600 dark:text-green-400">
//                           {emissionProgress.successfulInvoices}
//                         </p>
//                         <p className="text-xs text-gray-600 dark:text-gray-400">Exitosas</p>
//                       </div>
//                     </div>
//                   </CardContent>
//                 </Card>
//                 <Card className="border-red-200 dark:border-red-800">
//                   <CardContent className="pt-4">
//                     <div className="flex items-center gap-2">
//                       <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
//                       <div>
//                         <p className="text-2xl font-bold text-red-600 dark:text-red-400">
//                           {emissionProgress.failedInvoices}
//                         </p>
//                         <p className="text-xs text-gray-600 dark:text-gray-400">Fallidas</p>
//                       </div>
//                     </div>
//                   </CardContent>
//                 </Card>
//                 <Card className="border-blue-200 dark:border-blue-800">
//                   <CardContent className="pt-4">
//                     <div className="flex items-center gap-2">
//                       <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
//                       <div>
//                         <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
//                           {emissionProgress.totalInvoices}
//                         </p>
//                         <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
//                       </div>
//                     </div>
//                   </CardContent>
//                 </Card>
//               </div>
// 
//               {/* Resultados detallados */}
//               {emissionProgress.results.length > 0 && (
//                 <div className="border rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
//                   {emissionProgress.results.map((result, idx) => (
//                     <div
//                       key={idx}
//                       className={cn(
//                         'p-4 flex items-center justify-between',
//                         result.success ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-red-50/50 dark:bg-red-900/10'
//                       )}
//                     >
//                       <div className="flex items-center gap-3">
//                         {result.success ? (
//                           <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
//                         ) : (
//                           <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
//                         )}
//                         <div>
//                           <p className="text-sm font-medium text-gray-900 dark:text-white">
//                             Factura #{result.rowIndex + 1}
//                           </p>
//                           {result.success ? (
//                             <p className="text-xs text-gray-600 dark:text-gray-400">
//                               CUFE: {result.cufe?.substring(0, 20)}...
//                             </p>
//                           ) : (
//                             <p className="text-xs text-red-600 dark:text-red-400">
//                               {result.error}
//                             </p>
//                           )}
//                         </div>
//                       </div>
//                       {result.success && (
//                         <div className="flex gap-2">
//                           <Button
//                             size="sm"
//                             variant="outline"
//                             onClick={async () => {
//                               try {
//                                 const response = await fetch(`/api/invoices/${result.invoiceId}/pdf/download`);
//                                 if (!response.ok) throw new Error('Error al descargar PDF');
// 
//                                 const blob = await response.blob();
//                                 const url = window.URL.createObjectURL(blob);
//                                 const a = document.createElement('a');
//                                 a.href = url;
//                                 a.download = `factura-${result.rowIndex + 1}.pdf`;
//                                 document.body.appendChild(a);
//                                 a.click();
//                                 window.URL.revokeObjectURL(url);
//                                 document.body.removeChild(a);
// 
//                                 toast.success('PDF descargado correctamente');
//                               } catch (error) {
//                                 toast.error('No se pudo descargar el PDF');
//                               }
//                             }}
//                           >
//                             <Download className="h-4 w-4 mr-1" />
//                             PDF
//                           </Button>
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           )}
//         </CardContent>
// 
//         {/* Footer con botones de navegación */}
//         <div className="p-6 border-t flex items-center justify-between">
//           <Button
//             variant="outline"
//             onClick={previousStep}
//             disabled={currentStep === 'upload' || isProcessing}
//           >
//             <ChevronLeft className="h-4 w-4 mr-1" />
//             Anterior
//           </Button>
// 
//           <div className="flex gap-3">
//             {currentStep === 'emit' && !emissionProgress?.isEmitting && (
//               <Button
//                 variant="outline"
//                 onClick={resetEmission}
//               >
//                 Nueva Emisión
//               </Button>
//             )}
// 
//             {currentStep === 'upload' && (
//               <Button
//                 onClick={nextStep}
//                 disabled={!canProceedToPreview}
//               >
//                 Siguiente
//                 <ChevronRight className="h-4 w-4 ml-1" />
//               </Button>
//             )}
// 
//             {currentStep === 'preview' && (
//               <Button
//                 onClick={nextStep}
//                 disabled={!canProceedToEmit}
//               >
//                 Proceder a Emisión
//                 <ChevronRight className="h-4 w-4 ml-1" />
//               </Button>
//             )}
// 
//             {currentStep === 'emit' && !emissionProgress?.isEmitting && emissionProgress?.processedInvoices === 0 && (
//               <Button
//                 onClick={handleEmit}
//                 disabled={isProcessing}
//                 className="bg-green-600 hover:bg-green-700"
//               >
//                 {isProcessing ? (
//                   <>
//                     <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
//                     Emitiendo...
//                   </>
//                 ) : (
//                   <>
//                     <Send className="h-4 w-4 mr-1" />
//                     Emitir Facturas
//                   </>
//                 )}
//               </Button>
//             )}
//           </div>
//         </div>
//       </Card>
//     </div>
//   );
// }
// 
// /**
//  * Componente de paso del stepper
//  */
// function Step({
//   number,
//   title,
//   icon: Icon,
//   isActive,
//   isCompleted,
// }: {
//   number: number;
//   title: string;
//   icon: any;
//   isActive: boolean;
//   isCompleted: boolean;
// }) {
//   return (
//     <div className="flex flex-col items-center relative z-10">
//       <div
//         className={cn(
//           'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
//           isActive && 'bg-primary text-primary-foreground border-primary scale-110',
//           isCompleted && 'bg-green-600 text-white border-green-600',
//           !isActive && !isCompleted && 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-700'
//         )}
//       >
//         {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
//       </div>
//       <span
//         className={cn(
//           'mt-2 text-sm font-medium text-center',
//           isActive && 'text-primary',
//           isCompleted && 'text-green-600 dark:text-green-400',
//           !isActive && !isCompleted && 'text-gray-500 dark:text-gray-400'
//         )}
//       >
//         {title}
//       </span>
//     </div>
//   );
// }
// 
// /**
//  * Función auxiliar para parsear Excel con ExcelJS
//  */
// async function parseExcelFile(file: File): Promise<ParsedInvoiceData[]> {
//   try {
//     const buffer = await file.arrayBuffer();
//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.load(buffer);
//
//     const worksheet = workbook.worksheets[0];
//     if (!worksheet) {
//       throw new Error('No se encontró ninguna hoja en el archivo Excel');
//     }
//
//     // Convertir worksheet a array de objetos (equivalente a sheet_to_json)
//     const jsonData: any[] = [];
//     const headers: string[] = [];
//
//     // Primera fila contiene los headers
//     const headerRow = worksheet.getRow(1);
//     headerRow.eachCell((cell, colNumber) => {
//       headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
//     });
//
//     // Iterar resto de filas
//     worksheet.eachRow((row, rowNumber) => {
//       if (rowNumber === 1) return; // Skip header row
//
//       const rowData: any = {};
//       row.eachCell((cell, colNumber) => {
//         const header = headers[colNumber - 1];
//         if (header) {
//           rowData[header] = cell.value;
//         }
//       });
//
//       // Solo agregar filas que tengan al menos un valor
//       if (Object.keys(rowData).length > 0) {
//         jsonData.push(rowData);
//       }
//     });
//
//     if (!jsonData || jsonData.length === 0) {
//       throw new Error('El archivo Excel está vacío');
//     }
//
//     // Parsear filas
//     const parsedInvoices: ParsedInvoiceData[] = jsonData.map((row: any, idx: number) => {
//           const errors: string[] = [];
// 
//           // Extraer datos
//           const clientRuc = String(row['RUC Cliente'] || row['RUC'] || '').trim();
//           const clientDv = String(row['DV'] || '').trim();
//           const clientName = String(row['Nombre Cliente'] || row['Cliente'] || '').trim();
//           const description = String(row['Descripción'] || row['Descripcion'] || row['Producto'] || '').trim();
//           const quantity = parseFloat(row['Cantidad'] || 0);
//           const unitPrice = parseFloat(row['Precio Unitario'] || row['Precio'] || 0);
//           const taxRate = parseFloat(row['ITBMS (%)'] || row['ITBMS'] || 0.07);
// 
//           // Validaciones
//           if (!clientRuc) errors.push('RUC requerido');
//           if (!description) errors.push('Descripción requerida');
//           if (quantity <= 0) errors.push('Cantidad inválida');
//           if (unitPrice <= 0) errors.push('Precio inválido');
// 
//           // Calcular totales
//           const subtotal = quantity * unitPrice;
//           const taxAmount = subtotal * taxRate;
//           const total = subtotal + taxAmount;
// 
//           const item: ParsedInvoiceItem = {
//             description,
//             quantity,
//             unitPrice,
//             taxRate,
//             subtotal,
//             taxAmount,
//             total,
//           };
// 
//           return {
//             rowIndex: idx,
//             clientRuc,
//             clientDv,
//             clientName,
//             items: [item],
//             subtotal,
//             tax: taxAmount,
//             total,
//             isValid: errors.length === 0,
//             errors,
//           };
//         });
//
//     return parsedInvoices;
//   } catch (error: any) {
//     throw new Error(`Error al parsear Excel: ${error.message}`);
//   }
// }
