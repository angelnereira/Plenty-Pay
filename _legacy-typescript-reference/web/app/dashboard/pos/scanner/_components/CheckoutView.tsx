'use client';

import { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Printer, Check, Loader2, Bluetooth, Wifi, FileText } from 'lucide-react';
import QRCode from 'react-qr-code';
import type { CartItem } from '@/lib/pos/cart/use-pos-cart';
import { PrinterService, type ConnectionType, type PrinterConfig } from '@/lib/pos/thermal-printer/printer.service';
import { PRINTER_PROFILES, type PrinterProfile } from '@/lib/pos/thermal-printer/printer-profiles';
import { processSaleAction } from '@/app/actions/pos/process-sale.action';
import type { PaymentMethod as PosPaymentMethod } from '@/features/pos/types/pos-types';

interface CheckoutViewProps {
  items: CartItem[];
  total: number;
  businessName: string;
  onBack: () => void;
  onComplete: () => void;
}

type PaymentMethod = 'CASH' | 'QR' | 'CARD';
type PrinterStep = 'type' | 'profile' | 'ip' | 'done';

export function CheckoutView({ items, total, businessName, onBack, onComplete }: CheckoutViewProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printDone, setPrintDone] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
  const [printerStep, setPrinterStep] = useState<PrinterStep>('type');
  const [selectedType, setSelectedType] = useState<ConnectionType>('pdf');
  const [selectedProfile, setSelectedProfile] = useState<PrinterProfile>(PRINTER_PROFILES[0]);
  const [networkIp, setNetworkIp] = useState('');

  const serviceRef = useRef<PrinterService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new PrinterService();
  }

  const paymentLabels: Record<PaymentMethod, string> = {
    CASH: 'Efectivo',
    QR: 'QR / Yappy',
    CARD: 'Tarjeta',
  };

  const handleComplete = useCallback(async () => {
    setIsProcessing(true);
    setSaleError(null);
    try {
      const saleCart = items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        taxRate: i.taxRate,
        barcode: i.barcode,
        image: i.image,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stock: (i as any).stock ?? 0,
        quantity: i.qty,
      }));
      const result = await processSaleAction(saleCart, paymentMethod as PosPaymentMethod);
      if (result.success) {
        onComplete();
      } else {
        setSaleError(result.error ?? 'Error al procesar la venta');
      }
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setIsProcessing(false);
    }
  }, [items, paymentMethod, onComplete]);

  const handlePrint = useCallback(async () => {
    const service = serviceRef.current!;

    // First print: show setup if no config saved
    if (!PrinterService.hasConfig()) {
      setShowPrinterSetup(true);
      return;
    }

    setIsPrinting(true);
    setPrintError(null);
    try {
      await service.print({
        businessName,
        items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
        total,
        paymentMethod: paymentLabels[paymentMethod],
        date: new Date(),
      });
      setPrintDone(true);
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Error al imprimir');
    } finally {
      setIsPrinting(false);
    }
  }, [businessName, items, total, paymentMethod]);

  const handleSavePrinterConfig = useCallback(async () => {
    const service = serviceRef.current!;
    const config: PrinterConfig = {
      connectionType: selectedType,
      profile: selectedProfile,
      printerIp: networkIp || undefined,
    };
    service.updateConfig(config);

    setShowPrinterSetup(false);
    // Auto-print after config
    await handlePrint();
  }, [selectedType, selectedProfile, networkIp, handlePrint]);

  const subtotal = total / 1.07;
  const tax = total - subtotal;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-4 bg-white dark:bg-white/[0.06] border-b border-gray-100 dark:border-white/[0.1]">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.08]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-bold text-lg">Revisar Orden</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Items */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Productos
          </h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.qty}× {item.name}
                </span>
                <span className="font-medium">${(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.1] space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>ITBMS (7%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-black text-lg mt-2 pt-2 border-t border-gray-100 dark:border-white/[0.1]">
              <span>Total</span>
              <span className="text-violet-600">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Método de Pago
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(['CASH', 'QR', 'CARD'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  paymentMethod === m
                    ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                    : 'border-gray-100 dark:border-white/[0.1] text-gray-700 dark:text-gray-300'
                }`}
              >
                {paymentLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {/* QR payment */}
        {paymentMethod === 'QR' && (
          <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 shadow-sm flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">Escanear para pagar</p>
            <QRCode
              value={`https://plentypay.com/pay?amount=${total.toFixed(2)}`}
              size={160}
              className="rounded-lg"
            />
            <p className="text-2xl font-black text-violet-600">${total.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 px-4 pb-8 pt-3 bg-white dark:bg-white/[0.06] border-t border-gray-100 dark:border-white/[0.1] space-y-3">
        {(printError || saleError) && (
          <p className="text-red-500 text-sm text-center">{printError ?? saleError}</p>
        )}
        <button
          onClick={handlePrint}
          disabled={isPrinting || isProcessing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-violet-600 text-violet-600 font-semibold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-50"
        >
          {isPrinting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : printDone ? (
            <Check className="h-4 w-4" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          {printDone ? 'Impreso' : 'Imprimir Recibo'}
        </button>
        <button
          onClick={handleComplete}
          disabled={isProcessing}
          className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-base transition-colors active:scale-[0.98] disabled:opacity-60"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Procesando...
            </span>
          ) : (
            'Completar Venta'
          )}
        </button>
      </div>

      {/* Printer setup sheet */}
      {showPrinterSetup && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPrinterSetup(false)} />
          <div className="relative w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 shadow-2xl space-y-5">
            <div className="w-10 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
            <h3 className="font-bold text-lg text-center">Configurar Impresora</h3>

            {printerStep === 'type' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Seleccione el tipo de conexión</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 'bluetooth' as ConnectionType, icon: Bluetooth, label: 'Bluetooth' },
                    { type: 'network' as ConnectionType, icon: Wifi, label: 'WiFi / Red' },
                    { type: 'pdf' as ConnectionType, icon: FileText, label: 'Solo PDF', fullWidth: true },
                  ].map(({ type, icon: Icon, label, fullWidth }) => (
                    <button
                      key={type}
                      onClick={() => { setSelectedType(type); setPrinterStep(type === 'pdf' ? 'done' : 'profile'); }}
                      className={`${fullWidth ? 'col-span-2' : ''} flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-gray-100 dark:border-white/[0.08] hover:border-violet-400 font-medium text-sm transition-colors`}
                    >
                      <Icon className="h-5 w-5 text-violet-600" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {printerStep === 'profile' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">Seleccione el modelo de impresora</p>
                <div className="space-y-2">
                  {PRINTER_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        setSelectedProfile(profile);
                        setPrinterStep(selectedType === 'network' ? 'ip' : 'done');
                      }}
                      className="w-full text-left p-3 rounded-xl border-2 border-gray-100 dark:border-white/[0.08] hover:border-violet-400 transition-colors"
                    >
                      <p className="font-medium text-sm">{profile.label}</p>
                      <p className="text-xs text-muted-foreground">{profile.paperMm}mm · {profile.width} cols</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {printerStep === 'ip' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">IP de la impresora en red</p>
                <input
                  type="text"
                  value={networkIp}
                  onChange={(e) => setNetworkIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-white/[0.06] rounded-xl px-4 py-3 text-sm focus:border-violet-400 outline-none font-mono"
                />
                <button
                  onClick={() => setPrinterStep('done')}
                  className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold"
                >
                  Continuar
                </button>
              </div>
            )}

            {printerStep === 'done' && (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  Configuración lista: <strong>{selectedType}</strong>
                </p>
                <button
                  onClick={handleSavePrinterConfig}
                  className="w-full py-4 rounded-2xl bg-violet-600 text-white font-bold"
                >
                  Guardar e Imprimir
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
