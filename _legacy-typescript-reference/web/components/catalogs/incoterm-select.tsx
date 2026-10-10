'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@shared/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@shared/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@shared/ui/popover';
import { INCOTERMS, type IncotermCode } from '@/features/hka/model/types/catalogs/constants/incoterms';

interface IncotermSelectProps {
    value?: IncotermCode;
    onChange: (value: IncotermCode) => void;
    transportType?: 'ANY' | 'SEA_ONLY';
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    showDescription?: boolean;
}

export function IncotermSelect({
    value,
    onChange,
    transportType = 'ANY',
    placeholder = 'Seleccionar INCOTERM...',
    disabled = false,
    className,
    showDescription = true,
}: IncotermSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const incoterms = React.useMemo(() => Object.entries(INCOTERMS).map(([code, desc]) => ({
        code: code as IncotermCode,
        name: desc,
        description: desc,
        applicableFor: (['FAS', 'FOB', 'CFR', 'CIF'].includes(code) ? 'SEA_ONLY' : 'ANY') as 'ANY' | 'SEA_ONLY'
    })), []);
    const selectedIncoterm = value ? { code: value, name: INCOTERMS[value], description: INCOTERMS[value] } : null;

    // Filter incoterms
    const filteredIncoterms = React.useMemo(() => {
        let result = incoterms;

        // Filter by transport type
        if (transportType === 'SEA_ONLY') {
            result = result.filter((term) => term.applicableFor === 'SEA_ONLY');
        }

        // Filter by search
        if (search) {
            result = result.filter(
                (term) =>
                    term.code.toLowerCase().includes(search.toLowerCase()) ||
                    term.name.toLowerCase().includes(search.toLowerCase()) ||
                    term.description.toLowerCase().includes(search.toLowerCase())
            );
        }

        return result;
    }, [incoterms, search, transportType]);

    // Group by transport type
    const byType = React.useMemo(() => {
        const any = filteredIncoterms.filter((t) => t.applicableFor === 'ANY');
        const sea = filteredIncoterms.filter((t) => t.applicableFor === 'SEA_ONLY');
        return { any, sea };
    }, [filteredIncoterms]);

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
                        <Ship className="h-4 w-4 shrink-0 opacity-50" />
                        {selectedIncoterm ? (
                            <span className="truncate">
                                {selectedIncoterm.code} - {selectedIncoterm.description}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[450px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar INCOTERM..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandEmpty>No se encontraron INCOTERMS.</CommandEmpty>

                    {byType.any.length > 0 && (
                        <CommandGroup heading="Cualquier transporte" className="max-h-48 overflow-auto scrollbar-hide">
                            {byType.any.map((term) => (
                                <CommandItem
                                    key={term.code}
                                    value={term.code}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue.toUpperCase() as IncotermCode);
                                        setOpen(false);
                                    }}
                                    className="flex-col items-start"
                                >
                                    <div className="flex w-full items-center">
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                value === term.code ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{term.code}</span>
                                                <span className="text-sm font-medium">{term.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {term.description}
                                            </span>
                                            {showDescription && (
                                                <span className="text-xs text-muted-foreground mt-1">
                                                    {term.description.substring(0, 100)}...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {byType.sea.length > 0 && (
                        <CommandGroup heading="Solo transporte marítimo" className="max-h-48 overflow-auto scrollbar-hide">
                            {byType.sea.map((term) => (
                                <CommandItem
                                    key={term.code}
                                    value={term.code}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue.toUpperCase() as IncotermCode);
                                        setOpen(false);
                                    }}
                                    className="flex-col items-start"
                                >
                                    <div className="flex w-full items-center">
                                        <Check
                                            className={cn(
                                                'mr-2 h-4 w-4',
                                                value === term.code ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                        <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{term.code}</span>
                                                <span className="text-sm font-medium">{term.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {term.description}
                                            </span>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
}
