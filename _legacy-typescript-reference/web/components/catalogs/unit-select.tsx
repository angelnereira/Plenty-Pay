'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@shared/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@shared/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@shared/ui/popover';
import { UNITS, type UnitCode } from '@/features/hka/model/types/catalogs/constants/units';

interface UnitSelectProps {
    value?: UnitCode;
    onChange: (value: UnitCode) => void;
    filterByType?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function UnitSelect({
    value,
    onChange,
    filterByType,
    placeholder = 'Seleccionar unidad...',
    disabled = false,
    className,
}: UnitSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const units = React.useMemo(() => Object.entries(UNITS).map(([code, name]) => ({
        code: code as UnitCode,
        name,
        symbol: code,
        type: 'General',
        comment: ''
    })), []);
    const selectedUnit = value ? { code: value, name: UNITS[value], symbol: value, type: 'General', comment: '' } : null;

    // Filter and group units
    const { filteredUnits, groupedByType } = React.useMemo(() => {
        let filtered = units;

        // Filter by type if specified
        if (filterByType) {
            filtered = filtered.filter((unit) => unit.type === filterByType);
        }

        // Filter by search
        if (search) {
            filtered = filtered.filter(
                (unit) =>
                    unit.code.toLowerCase().includes(search.toLowerCase()) ||
                    unit.name.toLowerCase().includes(search.toLowerCase()) ||
                    unit.symbol.toLowerCase().includes(search.toLowerCase()) ||
                    unit.type.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Group by type
        const grouped = filtered.reduce((acc, unit) => {
            if (!acc[unit.type]) {
                acc[unit.type] = [];
            }
            acc[unit.type].push(unit);
            return acc;
        }, {} as Record<string, typeof filtered>);

        return { filteredUnits: filtered, groupedByType: grouped };
    }, [units, search, filterByType]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn('w-full justify-between', className)}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Ruler className="h-4 w-4 shrink-0 opacity-50" />
                        {selectedUnit ? (
                            <span className="truncate">
                                {selectedUnit.symbol} - {selectedUnit.name}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar unidad..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandEmpty>No se encontraron unidades.</CommandEmpty>
                    <CommandList className="max-h-[300px]">
                        {Object.entries(groupedByType).map(([type, typeUnits]) => (
                            <CommandGroup key={type} heading={type}>
                                {typeUnits.map((unit) => (
                                    <CommandItem
                                        key={unit.code}
                                        value={unit.code}
                                        onSelect={(currentValue) => {
                                            onChange(currentValue as UnitCode);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                value === unit.code ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {unit.symbol} - {unit.name}
                                                </span>
                                                {unit.comment && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {unit.comment}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
