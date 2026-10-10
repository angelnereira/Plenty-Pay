'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, DollarSign } from 'lucide-react';
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
import { CURRENCIES, type CurrencyCode } from '@/features/hka/model/types/catalogs/constants/currencies';

interface CurrencySelectProps {
    value?: CurrencyCode;
    onChange: (value: CurrencyCode) => void;
    region?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function CurrencySelect({
    value,
    onChange,
    region,
    placeholder = 'Seleccionar moneda...',
    disabled = false,
    className,
}: CurrencySelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const currencies = React.useMemo(() => Object.entries(CURRENCIES).map(([code, name]) => ({
        code: code as CurrencyCode,
        name,
        nameEs: name,
        symbol: ''
    })), []);
    const selectedCurrency = value ? { code: value, name: CURRENCIES[value], nameEs: CURRENCIES[value], symbol: '' } : null;

    // Filter currencies by region if specified
    const filteredCurrencies = React.useMemo(() => {
        let result = currencies;

        // TODO: Filter by region if implemented

        // Filter by search
        if (search) {
            result = result.filter(
                (currency) =>
                    currency.code.toLowerCase().includes(search.toLowerCase()) ||
                    currency.name.toLowerCase().includes(search.toLowerCase()) ||
                    currency.nameEs.toLowerCase().includes(search.toLowerCase())
            );
        }

        return result;
    }, [currencies, search]);

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
                        <DollarSign className="h-4 w-4 shrink-0 opacity-50" />
                        {selectedCurrency ? (
                            <span className="truncate">
                                {selectedCurrency.symbol} {selectedCurrency.code} - {selectedCurrency.nameEs}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar moneda..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandEmpty>No se encontraron monedas.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto scrollbar-hide">
                        {filteredCurrencies.map((currency) => (
                            <CommandItem
                                key={currency.code}
                                value={currency.code}
                                onSelect={(currentValue) => {
                                    onChange(currentValue.toUpperCase() as CurrencyCode);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        'mr-2 h-4 w-4',
                                        value === currency.code ? 'opacity-100' : 'opacity-0'
                                    )}
                                />
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {currency.symbol} {currency.code}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {currency.nameEs}
                                        </span>
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
