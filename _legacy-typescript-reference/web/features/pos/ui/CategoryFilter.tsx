"use client";

import { usePosStore } from '../stores/pos.store';
import { Badge } from '@shared/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
    variant?: 'horizontal' | 'vertical';
    className?: string;
}

export function CategoryFilter({ variant = 'horizontal', className }: CategoryFilterProps) {
    const { categories, filters, setFilters } = usePosStore();

    if (!categories || categories.length === 0) {
        return null;
    }

    const selectedCategory = filters.category;

    const handleCategoryClick = (category: string | undefined) => {
        setFilters({ category });
    };

    const allCategories = ['Todas', ...categories];

    if (variant === 'horizontal') {
        return (
            <div className={cn(
                "flex gap-2 overflow-x-auto pb-2 scrollbar-hide",
                className
            )}>
                {allCategories.map((cat) => {
                    const isAll = cat === 'Todas';
                    const categoryValue = isAll ? undefined : cat;
                    const isActive = isAll ? !selectedCategory : selectedCategory === cat;

                    return (
                        <Badge
                            key={cat}
                            variant={isActive ? "default" : "outline"}
                            className={cn(
                                "cursor-pointer whitespace-nowrap transition-all hover:scale-105",
                                isActive
                                    ? "bg-violet-600 text-white hover:bg-violet-700"
                                    : "hover:bg-violet-50 dark:hover:bg-violet-900/20"
                            )}
                            onClick={() => handleCategoryClick(categoryValue)}
                        >
                            {cat}
                            {isActive && !isAll && (
                                <X className="ml-1 h-3 w-3" />
                            )}
                        </Badge>
                    );
                })}
            </div>
        );
    }

    // Vertical variant
    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {allCategories.map((cat) => {
                const isAll = cat === 'Todas';
                const categoryValue = isAll ? undefined : cat;
                const isActive = isAll ? !selectedCategory : selectedCategory === cat;

                return (
                    <Badge
                        key={cat}
                        variant={isActive ? "default" : "outline"}
                        className={cn(
                            "cursor-pointer transition-all hover:scale-105",
                            isActive
                                ? "bg-violet-600 text-white hover:bg-violet-700"
                                : "hover:bg-violet-50 dark:hover:bg-violet-900/20"
                        )}
                        onClick={() => handleCategoryClick(categoryValue)}
                    >
                        {cat}
                        {isActive && !isAll && (
                            <X className="ml-1 h-3 w-3" />
                        )}
                    </Badge>
                );
            })}
        </div>
    );
}
