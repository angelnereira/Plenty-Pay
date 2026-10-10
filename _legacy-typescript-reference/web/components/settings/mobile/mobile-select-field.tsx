'use client';

import { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileSelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    description?: string;
    children: ReactNode;
}

export const MobileSelectField = forwardRef<HTMLSelectElement, MobileSelectFieldProps>(
    ({ label, error, description, children, className, ...props }, ref) => {
        return (
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-400 ml-1">
                    {label}
                </label>
                <select
                    ref={ref}
                    className={cn(
                        'w-full bg-gray-50 dark:bg-slate-950 border rounded-xl py-3 px-4',
                        'text-gray-900 dark:text-white appearance-none',
                        'focus:outline-none focus:border-blue-500 transition-colors',
                        error ? 'border-red-500' : 'border-gray-200 dark:border-slate-800',
                        className
                    )}
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 1rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                    }}
                    {...props}
                >
                    {children}
                </select>
                {description && !error && (
                    <p className="text-xs text-gray-500 dark:text-slate-500 ml-1">{description}</p>
                )}
                {error && (
                    <p className="text-xs text-red-500 dark:text-red-400 ml-1">{error}</p>
                )}
            </div>
        );
    }
);

MobileSelectField.displayName = 'MobileSelectField';

