import { useState } from 'react';
import { Receipt, TrendingUp, Clock, CheckCircle, Eye, EyeOff, Lock, Calculator } from 'lucide-react';
import { FoliosDisplay } from './folios-display';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { verifyPassword } from '@/actions/security';
import { toast } from 'sonner';
import { BillingCardMode } from '@/actions/user-preferences';

interface HeroFinancialCardProps {
    totalAmount: string;
    certifiedCount: string;
    pendingCount: string;
    /** ITBMS acumulado a pagar (string numérico, ej. "1234.56"). */
    accumulatedItbms?: string;
    usageCounter?: string;
    className?: string;
    mode?: BillingCardMode;
    onFoliosClick?: () => void;
}

export function HeroFinancialCard({
    totalAmount,
    certifiedCount,
    pendingCount,
    accumulatedItbms = '0',
    usageCounter = '0/5k',
    className,
    mode = 'DEFAULT',
    onFoliosClick,
}: HeroFinancialCardProps) {
    const [isRevealed, setIsRevealed] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const formattedAmount = Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedItbms = formatCurrency(accumulatedItbms);

    const handleReveal = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await verifyPassword(passwordInput);
            if (result.success) {
                setIsRevealed(true);
                setIsPasswordModalOpen(false);
                setPasswordInput('');
                toast.success('Monto revelado');
            } else {
                toast.error(result.error || 'Contraseña incorrecta');
            }
        } catch (error) {
            toast.error('Error al verificar contraseña');
        } finally {
            setIsLoading(false);
        }
    };

    // Modes
    if (mode === 'HIDDEN') {
        return (
            <div className={cn(
                'relative overflow-hidden rounded-xl p-5 sm:p-6 md:p-8',
                'bg-slate-100 dark:bg-white/[0.06] dark:backdrop-blur-2xl',
                'border border-slate-200 dark:border-white/[0.1]',
                className
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <TrendingUp className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Facturación Total</h3>
                            <p className="text-sm text-slate-500">Documentos emitidos: {usageCounter.split('/')[0]}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                            {certifiedCount} Emitidas
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'DISCRETE') {
        return (
            <div className={cn(
                'relative overflow-hidden rounded-xl p-5 sm:p-6 md:p-8',
                'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl',
                'border border-slate-200 dark:border-white/[0.1]',
                'shadow-sm',
                className
            )}>
                <div className="flex items-start justify-between mb-4">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Facturación Total</span>
                    <div className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {usageCounter} Doc.
                    </div>
                </div>
                <div className="mb-2">
                    <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        ${formattedAmount}
                    </h2>
                </div>
                <div className="mb-5 flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Recaudación de impuestos:</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{formattedItbms}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{certifiedCount} Emitidas</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">{pendingCount} Pendientes</span>
                    </div>
                </div>
            </div>
        )
    }

    // DEFAULT and MASKED (Masked logic built into default structure)
    const isMasked = mode === 'MASKED' && !isRevealed;

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-xl p-5 sm:p-6 md:p-8',
                // Light: soft blue gradient | Dark: slate gradient
                'bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800',
                'dark:from-white/[0.08] dark:via-white/[0.04] dark:to-white/[0.06]',
                'border border-violet-500/30 dark:border-white/[0.1]',
                'shadow-xl shadow-violet-500/20 dark:shadow-[0_0_80px_-20px_rgba(139,92,246,0.15)]',
                'dark:backdrop-blur-2xl',
                className
            )}
        >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 md:w-64 md:h-64 opacity-10 dark:opacity-5 transform rotate-12 md:translate-x-10 md:-translate-y-10">
                <Receipt className="w-full h-full text-white" />
            </div>

            {/* Glow Effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-white/20 dark:bg-violet-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 md:w-64 md:h-64 bg-purple-300/20 dark:bg-purple-500/10 rounded-full blur-2xl" />

            {/* Content */}
            <div className="relative z-10">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4 md:mb-8">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-2 md:p-2.5 rounded-lg bg-white/20 dark:bg-violet-500/20 backdrop-blur-sm">
                            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-white dark:text-violet-400" />
                        </div>
                        <span className="text-sm md:text-base font-medium text-violet-100 dark:text-slate-400">
                            Facturación Total
                        </span>
                    </div>

                    {/* Usage Counter */}
                    <div className="px-2.5 py-1 md:px-4 md:py-1.5 rounded-full bg-white/20 dark:bg-slate-800/80 border border-white/30 dark:border-slate-700/50 backdrop-blur-sm">
                        <span className="text-xs md:text-sm font-medium text-white dark:text-slate-300">
                            {usageCounter} Doc.
                        </span>
                    </div>
                </div>

                {/* Main Amount */}
                <div className="mb-6 md:mb-8 flex items-center gap-4">
                    <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight">
                        {isMasked ? '******' : `$${formattedAmount}`}
                    </h2>
                    {mode === 'MASKED' && (
                        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white/70 hover:text-white hover:bg-white/20 rounded-full h-10 w-10 sm:h-12 sm:w-12 transition-all mt-2"
                                    onClick={() => isRevealed && setIsRevealed(false)} // Toggle hide if already revealed
                                >
                                    {isRevealed ? <EyeOff className="h-6 w-6 sm:h-8 sm:w-8" /> : <Eye className="h-6 w-6 sm:h-8 sm:w-8" />}
                                </Button>
                            </DialogTrigger>
                            {!isRevealed && (
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Verificación Requerida</DialogTitle>
                                        <DialogDescription>
                                            Ingresa tu contraseña para visualizar el monto total de facturación.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleReveal} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Contraseña</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                value={passwordInput}
                                                onChange={(e) => setPasswordInput(e.target.value)}
                                                placeholder="Ingresa tu contraseña"
                                                autoFocus
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="outline" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</Button>
                                            <Button type="submit" disabled={isLoading || !passwordInput}>
                                                {isLoading ? 'Verificando...' : 'Ver Monto'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            )}
                        </Dialog>
                    )}
                </div>

                {/* Recaudación de impuestos (ITBMS) — dato fiscal secundario */}
                <div className="-mt-3 mb-5 md:-mt-5 md:mb-7 flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5 text-violet-200 dark:text-slate-400" />
                    <span className="text-xs md:text-sm font-medium text-violet-100 dark:text-slate-400">
                        Recaudación de impuestos:
                    </span>
                    <span className="text-xs md:text-sm font-bold text-white">
                        {isMasked ? '••••' : formattedItbms}
                    </span>
                </div>

                {/* Status Pills */}
                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                    {/* Emitidas Pill */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-emerald-400/20 dark:bg-emerald-500/10 border border-emerald-300/40 dark:border-emerald-500/20 md:backdrop-blur-sm transition-transform hover:scale-105">
                        <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-200 dark:text-emerald-400" />
                        <span className="text-xs md:text-sm font-semibold text-emerald-100 dark:text-emerald-400">
                            Emitidas: {certifiedCount}
                        </span>
                    </div>

                    {/* En Proceso Pill */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-amber-400/20 dark:bg-amber-500/10 border border-amber-300/40 dark:border-amber-500/20 md:backdrop-blur-sm transition-transform hover:scale-105">
                        <Clock className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-200 dark:text-amber-400" />
                        <span className="text-xs md:text-sm font-semibold text-amber-100 dark:text-amber-400">
                            En Proceso: {pendingCount}
                        </span>
                    </div>

                    {/* Folios Display — consulta bajo demanda */}
                    <FoliosDisplay onClick={onFoliosClick} />
                </div>
            </div>
        </div>
    );
}

export function HeroFinancialCardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn(
            'relative overflow-hidden rounded-xl p-5 sm:p-6 md:p-8 animate-pulse',
            'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700',
            className
        )}>
            <div className="flex items-start justify-between mb-8">
                <div className="h-6 w-32 bg-slate-300 dark:bg-slate-700 rounded-md" />
                <div className="h-6 w-24 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>
            <div className="h-16 w-3/4 bg-slate-300 dark:bg-slate-700 rounded-xl mb-8" />
            <div className="flex gap-4">
                <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded-full" />
                <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>
        </div>
    );
}
