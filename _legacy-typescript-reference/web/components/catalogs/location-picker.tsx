'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
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
import { LocationsAPIResponse } from '@shared/types/catalog-api';

interface LocationPickerProps {
    value?: string;
    onChange: (value: string) => void;
    provincia?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export function LocationPicker({
    value,
    onChange,
    provincia,
    placeholder = 'Seleccionar ubicación...',
    disabled = false,
    className,
}: LocationPickerProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [locations, setLocations] = React.useState<LocationsAPIResponse['data']>([]);
    const [loading, setLoading] = React.useState(false);

    const selectedLocation = locations.find((loc) => loc.code === value);

    // Fetch locations when search changes or provincia filter changes
    React.useEffect(() => {
        const fetchLocations = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (search) params.append('q', search);
                if (provincia) params.append('provincia', provincia);
                params.append('limit', '20');

                const response = await fetch(`/api/catalogs/locations?${params}`);
                const data: LocationsAPIResponse = await response.json();

                if (data.success) {
                    setLocations(data.data);
                }
            } catch (error) {
                console.error('Error fetching locations:', error);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(fetchLocations, 300);
        return () => clearTimeout(debounce);
    }, [search, provincia]);

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
                        <MapPin className="h-4 w-4 shrink-0 opacity-50" />
                        {selectedLocation ? (
                            <span className="truncate">{selectedLocation.fullName}</span>
                        ) : (
                            <span className="text-muted-foreground">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Buscar provincia, distrito, corregimiento..."
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandEmpty>
                        {loading ? 'Buscando...' : 'No se encontraron ubicaciones.'}
                    </CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto scrollbar-hide">
                        {locations.map((location) => (
                            <CommandItem
                                key={location.code}
                                value={location.code}
                                onSelect={(currentValue) => {
                                    onChange(currentValue === value ? '' : currentValue);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        'mr-2 h-4 w-4',
                                        value === location.code ? 'opacity-100' : 'opacity-0'
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium">{location.corregimiento}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {location.provincia} → {location.distrito}
                                    </span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
