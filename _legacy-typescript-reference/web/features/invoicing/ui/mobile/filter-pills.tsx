'use client';

import { cn } from '@/lib/utils';

interface FilterPillsProps {
    filters: {
        id: string;
        label: string;
        count: number;
    }[];
    activeFilter: string;
    onFilterChange: (filterId: string) => void;
}

export function FilterPills({ filters, activeFilter, onFilterChange }: FilterPillsProps) {
    return (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 no-scrollbar -mx-4 px-4">
            {filters.map((filter) => (
                <button
                    key={filter.id}
                    onClick={() => onFilterChange(filter.id)}
                    className={cn(
                        'whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                        'flex items-center gap-1.5 border',
                        activeFilter === filter.id
                            ? 'bg-blue-100 dark:bg-blue-600/20 border-blue-300 dark:border-blue-500 text-blue-700 dark:text-blue-400'
                            : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                    )}
                >
                    {filter.label}
                    <span
                        className={cn(
                            'text-xs',
                            activeFilter === filter.id ? 'text-blue-500 dark:text-blue-300' : 'text-gray-400 dark:text-slate-500'
                        )}
                    >
                        ({filter.count})
                    </span>
                </button>
            ))}
        </div>
    );
}

