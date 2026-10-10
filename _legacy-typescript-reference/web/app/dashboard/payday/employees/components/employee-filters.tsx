'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';

export function EmployeeFilters() {
    const [showFilters, setShowFilters] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [credentialFilter, setCredentialFilter] = useState<'all' | 'face' | 'qr' | 'pin' | 'nfc' | 'none'>('all');

    return (
        <div className="premium-card p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Filtros</span>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                    {showFilters ? 'Ocultar' : 'Mostrar'}
                </button>
            </div>

            {showFilters && (
                <div className="space-y-4">
                    {/* Status Filter */}
                    <div>
                        <label className="text-xs font-medium text-slate-600 mb-2 block">
                            Estado
                        </label>
                        <div className="flex gap-2">
                            <FilterButton
                                active={activeFilter === 'all'}
                                onClick={() => setActiveFilter('all')}
                                label="Todos"
                            />
                            <FilterButton
                                active={activeFilter === 'active'}
                                onClick={() => setActiveFilter('active')}
                                label="Activos"
                                color="green"
                            />
                            <FilterButton
                                active={activeFilter === 'inactive'}
                                onClick={() => setActiveFilter('inactive')}
                                label="Inactivos"
                                color="red"
                            />
                        </div>
                    </div>

                    {/* Credential Filter */}
                    <div>
                        <label className="text-xs font-medium text-slate-600 mb-2 block">
                            Credenciales
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <FilterButton
                                active={credentialFilter === 'all'}
                                onClick={() => setCredentialFilter('all')}
                                label="Todos"
                            />
                            <FilterButton
                                active={credentialFilter === 'face'}
                                onClick={() => setCredentialFilter('face')}
                                label="Con Face ID"
                                color="purple"
                            />
                            <FilterButton
                                active={credentialFilter === 'qr'}
                                onClick={() => setCredentialFilter('qr')}
                                label="Con QR"
                                color="blue"
                            />
                            <FilterButton
                                active={credentialFilter === 'pin'}
                                onClick={() => setCredentialFilter('pin')}
                                label="Con PIN"
                                color="orange"
                            />
                            <FilterButton
                                active={credentialFilter === 'nfc'}
                                onClick={() => setCredentialFilter('nfc')}
                                label="Con NFC"
                                color="sky"
                            />
                            <FilterButton
                                active={credentialFilter === 'none'}
                                onClick={() => setCredentialFilter('none')}
                                label="Sin credenciales"
                                color="gray"
                            />
                        </div>
                    </div>

                    {/* Clear Filters */}
                    {(activeFilter !== 'all' || credentialFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setActiveFilter('all');
                                setCredentialFilter('all');
                            }}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700"
                        >
                            <X className="h-3 w-3" />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function FilterButton({
    active,
    onClick,
    label,
    color = 'gray'
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    color?: string;
}) {
    const colorClasses = {
        gray: active ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        green: active ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200',
        red: active ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200',
        purple: active ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200',
        blue: active ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
        orange: active ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200',
        sky: active ? 'bg-sky-600 text-white' : 'bg-sky-100 text-sky-700 hover:bg-sky-200',
    }[color];

    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${colorClasses}`}
        >
            {label}
        </button>
    );
}
