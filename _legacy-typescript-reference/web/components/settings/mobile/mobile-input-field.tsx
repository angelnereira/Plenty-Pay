'use client';

import { forwardRef, InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileInputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    description?: string;
    showPasswordToggle?: boolean;
}

export const MobileInputField = forwardRef<HTMLInputElement, MobileInputFieldProps>(
    ({ label, error, description, showPasswordToggle, type = 'text', className, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

        return (
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-400 ml-1">
                    {label}
                </label>
                <div className="relative">
                    <input
                        ref={ref}
                        type={inputType}
                        className={cn(
                            'w-full bg-gray-50 dark:bg-slate-950 border rounded-xl py-3 px-4',
                            'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600',
                            'focus:outline-none focus:border-blue-500 transition-colors',
                            error ? 'border-red-500' : 'border-gray-200 dark:border-slate-800',
                            showPasswordToggle && 'pr-12',
                            className
                        )}
                        {...props}
                    />
                    {showPasswordToggle && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    )}
                </div>
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

MobileInputField.displayName = 'MobileInputField';

