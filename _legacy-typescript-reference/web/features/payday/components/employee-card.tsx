'use client';

import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Check, X, User, QrCode, Fingerprint, CreditCard } from 'lucide-react';
import Link from 'next/link';
import type { PaydayContractType } from '@prisma/client';

interface EmployeeCardProps {
    id: string;
    employeeCode: string | null;
    firstName: string;
    lastName: string;
    cedula: string;
    contractType: PaydayContractType;
    baseSalary: number;
    isActive: boolean;
    // Credentials status
    hasPIN: boolean;
    hasQR: boolean;
    hasFace: boolean;
    hasNFC: boolean;
}

export function EmployeeCard({
    id,
    employeeCode,
    firstName,
    lastName,
    cedula,
    contractType,
    baseSalary,
    isActive,
    hasPIN,
    hasQR,
    hasFace,
    hasNFC,
}: EmployeeCardProps) {
    const initials = `${firstName[0]}${lastName[0]}`;
    const activeCredentials = [hasPIN, hasQR, hasFace, hasNFC].filter(Boolean).length;

    return (
        <Link href={`/dashboard/payday/employees/${id}`}>
            <Card className="premium-card hover:border-primary/50 transition-all duration-300 group cursor-pointer">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        {/* Avatar & Info */}
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                <span className="text-lg font-bold text-primary">{initials}</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                    {firstName} {lastName}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {employeeCode && (
                                        <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                            {employeeCode}
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-400">• {cedula}</span>
                                </div>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                            {isActive ? "Activo" : "Inactivo"}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    {/* Contract Info */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Contrato</span>
                        <span className="font-medium text-slate-900">{contractType}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Salario Base</span>
                        <span className="font-bold text-green-600">
                            ${Number(baseSalary).toLocaleString('es-PA')}
                        </span>
                    </div>

                    {/* Credentials Status */}
                    <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 font-medium">
                                Credenciales de Acceso
                            </span>
                            <span className="text-xs font-bold text-primary">
                                {activeCredentials}/4
                            </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {/* PIN */}
                            <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${hasPIN
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}>
                                <User className={`h-4 w-4 ${hasPIN ? 'text-green-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-medium text-slate-600">PIN</span>
                                {hasPIN ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                    <X className="h-3 w-3 text-slate-400" />
                                )}
                            </div>

                            {/* QR */}
                            <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${hasQR
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}>
                                <QrCode className={`h-4 w-4 ${hasQR ? 'text-green-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-medium text-slate-600">QR</span>
                                {hasQR ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                    <X className="h-3 w-3 text-slate-400" />
                                )}
                            </div>

                            {/* Face */}
                            <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${hasFace
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}>
                                <User className={`h-4 w-4 ${hasFace ? 'text-green-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-medium text-slate-600">Rostro</span>
                                {hasFace ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                    <X className="h-3 w-3 text-slate-400" />
                                )}
                            </div>

                            {/* NFC */}
                            <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${hasNFC
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}>
                                <CreditCard className={`h-4 w-4 ${hasNFC ? 'text-green-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-medium text-slate-600">NFC</span>
                                {hasNFC ? (
                                    <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                    <X className="h-3 w-3 text-slate-400" />
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
