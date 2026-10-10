"use client";

import { usePosStore, PosProduct } from "../stores/pos.store";
import { usePosDualScreen } from "../hooks/use-pos-dual-screen";
import { playSuccessBeep, playErrorBeep } from "@/lib/pos/scanner/audio-feedback";
import { Card } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Search, Package, Plus, ScanBarcode, Receipt, Grid3x3, List, Filter, X, Heart, Monitor } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Switch } from "@shared/ui/switch";
import { Label } from "@shared/ui/label";
import { useToast } from "@shared/hooks/use-toast";
import type { ReceiptTemplateType } from "./receipt-templates";
import { CategoryFilter } from "./CategoryFilter";
import { Badge } from "@shared/ui/badge";
import { cn } from "@/lib/utils";
import { PosAnalyticsWidget } from "./PosAnalyticsWidget";

interface ProductGridProps {
    initialProducts: PosProduct[];
}

export function ProductGrid({ initialProducts }: ProductGridProps) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [scannerMode, setScannerMode] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const addToCart = usePosStore(state => state.addToCart);
    const selectedTemplate = usePosStore(state => state.selectedTemplate);
    const setSelectedTemplate = usePosStore(state => state.setSelectedTemplate);
    const viewMode = usePosStore(state => state.viewMode);
    const setViewMode = usePosStore(state => state.setViewMode);
    const filters = usePosStore(state => state.filters);
    const setFilters = usePosStore(state => state.setFilters);
    const setCategories = usePosStore(state => state.setCategories);

    const favorites = usePosStore(state => state.favorites);
    const toggleFavorite = usePosStore(state => state.toggleFavorite);
    const [showFavorites, setShowFavorites] = useState(false);
    const { openCustomerWindow, connected } = usePosDualScreen('HOST');

    const { toast } = useToast();

    // Extract unique categories from products
    useEffect(() => {
        const uniqueCategories = Array.from(
            new Set(initialProducts.map(p => p.category).filter(Boolean))
        ) as string[];
        setCategories(uniqueCategories);
    }, [initialProducts, setCategories]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);

    // Scanner Logic
    const bufferRef = useRef<string>("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!scannerMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is on an input or textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            // If it's Enter, try to process the buffer
            if (e.key === 'Enter') {
                if (bufferRef.current.length > 0) {
                    processScan(bufferRef.current);
                    bufferRef.current = "";
                }
                return;
            }

            // Accumulate alphanumeric characters
            if (e.key.length === 1) {
                bufferRef.current += e.key;

                // Clear buffer if scanning takes too long (manual typing vs scanner)
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    bufferRef.current = "";
                }, 100); // Scanners are fast (< 50ms per key)
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [scannerMode]);

    const processScan = (code: string) => {
        const product = initialProducts.find(p =>
            p.barcode === code || p.sku === code
        );

        if (product) {
            addToCart(product);
            playSuccessBeep();
            toast({
                title: "Producto Agregado",
                description: `${product.name} añadido al carrito.`,
                duration: 1500
            });
        } else {
            playErrorBeep();
            toast({
                variant: "destructive",
                title: "Código no encontrado",
                description: `No hay producto con código: ${code}`,
            });
        }
    };

    // Apply all filters
    const filteredProducts = useMemo(() => {
        let products = initialProducts;

        // Favorites filter
        if (showFavorites) {
            products = products.filter(p => favorites.includes(p.id));
        }

        // Text search
        if (debouncedSearch) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                p.sku?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                p.barcode?.toLowerCase().includes(debouncedSearch.toLowerCase())
            );
        }

        // Category filter
        if (filters.category) {
            products = products.filter(p => p.category === filters.category);
        }

        // Stock filter
        if (filters.inStockOnly) {
            products = products.filter(p => p.stock > 0);
        }

        // Price range filter
        if (filters.minPrice !== undefined) {
            products = products.filter(p => p.price >= filters.minPrice!);
        }
        if (filters.maxPrice !== undefined) {
            products = products.filter(p => p.price <= filters.maxPrice!);
        }

        return products;
    }, [initialProducts, debouncedSearch, filters, showFavorites, favorites]);

    const hasActiveFilters = filters.category || filters.inStockOnly || filters.minPrice || filters.maxPrice || showFavorites;

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header / Controls */}
            <div className="flex flex-col gap-4 mb-6">
                {/* Main Action Bar */}
                <div className="flex items-center justify-between gap-4">
                    {/* Search Group */}
                    <div className="flex-1 max-w-2xl relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nombre, SKU o código..."
                            className="pl-9 h-11 bg-white dark:bg-white/[0.06] border-none shadow-sm ring-1 ring-gray-200 dark:ring-white/[0.1]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                                onClick={() => setSearch("")}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Actions Group */}
                    <div className="flex items-center gap-3">
                        {/* Scanner Toggle (Manual/Auto) */}
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer",
                            scannerMode
                                ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800 text-green-700 dark:text-green-400"
                                : "bg-white dark:bg-white/[0.06] border-gray-200 dark:border-white/[0.1] text-gray-500"
                        )}
                            onClick={() => setScannerMode(!scannerMode)}
                        >
                            <ScanBarcode className="h-4 w-4" />
                            <span className="text-xs font-bold whitespace-nowrap hidden sm:block">
                                {scannerMode ? 'AUTO' : 'MANUAL'}
                            </span>
                        </div>

                        {/* Dual Screen Toggle */}
                        <Button
                            variant={connected ? "default" : "outline"}
                            size="icon"
                            className={cn("h-10 w-10", connected && "bg-blue-600 hover:bg-blue-700")}
                            onClick={openCustomerWindow}
                            title="Abrir Pantalla Cliente"
                        >
                            <Monitor className="h-4 w-4" />
                        </Button>

                        {/* Favorites */}
                        <Button
                            variant={showFavorites ? "default" : "outline"}
                            size="icon"
                            className={cn("h-10 w-10", showFavorites && "bg-amber-500 hover:bg-amber-600 text-white")}
                            onClick={() => setShowFavorites(!showFavorites)}
                        >
                            <Heart className={cn("h-4 w-4", showFavorites ? "fill-current" : "")} />
                        </Button>

                        {/* View Modes */}
                        <div className="flex bg-gray-100 dark:bg-white/[0.06] rounded-lg p-1 border dark:border-white/[0.1]">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode('grid')}
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'ghost'}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Advanced Filters */}
                        <Button
                            variant={showFilters ? "default" : "outline"}
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4" />
                        </Button>

                        {/* Analytics Widget */}
                        <PosAnalyticsWidget />
                    </div>
                </div>

                {/* Second Row: Categories and Template */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 overflow-hidden">
                        {!showFavorites && <CategoryFilter variant="vertical" />}
                    </div>

                    {/* Template Selector */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-lg border dark:border-white/[0.1] shrink-0">
                        <Receipt className="h-4 w-4 text-violet-500" />
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value as ReceiptTemplateType)}
                            className="bg-transparent text-xs font-bold text-gray-700 dark:text-gray-300 border-none outline-none cursor-pointer focus:ring-0"
                        >
                            <option value="modern">MODERNO</option>
                            <option value="professional">PROFESIONAL</option>
                            <option value="creative">CREATIVO</option>
                            <option value="thermal">TÉRMICA</option>
                        </select>
                    </div>
                </div>

                {/* Advanced Filters Panel (Conditional) */}
                {showFilters && (
                    <div className="bg-gray-50 dark:bg-white/[0.06] border dark:border-white/[0.1] rounded-xl p-4 shadow-inner">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500">Filtros Avanzados</h3>
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setFilters({ inStockOnly: false, category: undefined, minPrice: undefined, maxPrice: undefined });
                                        setShowFavorites(false);
                                    }}
                                    className="text-xs h-7"
                                >
                                    Limpiar todo
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-[10px] font-bold uppercase mb-1.5 block text-gray-400">Precio Mín.</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="$0.00"
                                    value={filters.minPrice || ''}
                                    onChange={(e) => setFilters({ minPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold uppercase mb-1.5 block text-gray-400">Precio Máx.</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="$999.99"
                                    value={filters.maxPrice || ''}
                                    onChange={(e) => setFilters({ maxPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch
                                    id="stock-filter"
                                    checked={filters.inStockOnly}
                                    onCheckedChange={(checked) => setFilters({ inStockOnly: checked })}
                                />
                                <Label htmlFor="stock-filter" className="text-xs font-medium cursor-pointer">
                                    Solo en stock
                                </Label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results count */}
                <div className="flex justify-between items-center bg-white dark:bg-white/[0.04] p-1 px-3 rounded-full border dark:border-white/[0.08] w-fit">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {filteredProducts.length} Resultado{filteredProducts.length !== 1 ? 's' : ''}
                    </span>
                    {showFavorites && <Badge className="ml-2 bg-amber-500 hover:bg-amber-600 text-white text-[9px] h-4">FAVORITOS</Badge>}
                </div>
            </div>

            {/* Products Grid or List */}
            <div className={cn(
                "overflow-y-auto scrollbar-hide pr-2 pb-4 flex-1 min-h-0 custom-scrollbar",
                viewMode === 'grid'
                    ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 content-start"
                    : "flex flex-col gap-2"
            )}>
                {filteredProducts.map(product => (
                    viewMode === 'grid' ? (
                        <ProductCardGrid
                            key={product.id}
                            product={product}
                            onAdd={() => addToCart(product)}
                            isFavorite={favorites.includes(product.id)}
                            onToggleFavorite={() => toggleFavorite(product.id)}
                        />
                    ) : (
                        <ProductCardList
                            key={product.id}
                            product={product}
                            onAdd={() => addToCart(product)}
                            isFavorite={favorites.includes(product.id)}
                            onToggleFavorite={() => toggleFavorite(product.id)}
                        />
                    )
                ))}

                {filteredProducts.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                        <div className="bg-gray-100 dark:bg-white/[0.06] p-8 rounded-full mb-6 border-4 border-white dark:border-white/[0.1] shadow-xl ring-1 ring-gray-100 dark:ring-white/[0.1] animate-in fade-in zoom-in duration-500">
                            {showFavorites ? (
                                <Heart className="h-16 w-16 text-amber-500/50" />
                            ) : (
                                <Package className="h-16 w-16 text-violet-500/50" />
                            )}
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                            {showFavorites ? "Sin favoritos" : "Sin resultados"}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                            {showFavorites
                                ? "Marca productos como favoritos para verlos aquí."
                                : `No pudimos encontrar "${search}" en nuestro catálogo actual.`}
                        </p>
                        {!showFavorites && search && (
                            <Button
                                variant="outline"
                                className="mt-6 font-bold text-xs uppercase tracking-widest"
                                onClick={() => setSearch("")}
                            >
                                Ver todos los productos
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Grid Card Component
function ProductCardGrid({ product, onAdd, isFavorite, onToggleFavorite }: { product: PosProduct; onAdd: () => void; isFavorite: boolean; onToggleFavorite: (e: any) => void }) {
    return (
        <div
            className="group flex flex-col h-full bg-white dark:bg-white/[0.06] rounded-xl border border-gray-100 dark:border-white/[0.1] hover:border-violet-500 dark:hover:border-violet-500 transition-all cursor-pointer p-3 shadow-sm hover:shadow-md"
            onClick={onAdd}
        >
            {/* Imagen compacta */}
            <div className="h-32 bg-gray-50 dark:bg-white/[0.04] rounded-lg flex items-center justify-center mb-3 relative overflow-hidden shrink-0">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                    />
                ) : (
                    <Package className="h-8 w-8 text-gray-300" />
                )}

                {/* Badge de Stock overlay */}
                <span className={cn(
                    "absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md",
                    product.stock <= 0
                        ? "bg-red-500/80 text-white"
                        : "bg-black/40 text-white"
                )}>
                    {product.stock <= 0 ? 'AGOTADO' : `STK: ${product.stock}`}
                </span>

                {/* Favorite Toggle button */}
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "absolute top-2 right-2 h-7 w-7 rounded-full transition-all duration-300",
                        isFavorite
                            ? "bg-amber-500 text-white opacity-100"
                            : "bg-white/80 dark:bg-white/10 text-gray-400 opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(e);
                    }}
                >
                    <Heart className={cn("h-3.5 w-3.5", isFavorite ? "fill-current" : "")} />
                </Button>
            </div>

            <div className="flex flex-col flex-1">
                <div className="mb-2">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 min-h-[2.5rem]">
                        {product.name}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1 mt-1">
                        {product.sku && <span>SKU: {product.sku}</span>}
                        {product.sku && product.category && <span>•</span>}
                        {product.category && <span className="truncate">{product.category}</span>}
                    </p>
                </div>

                {/* Footer de la tarjeta: Precio y Acción */}
                <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-violet-600 dark:text-violet-400 leading-none">
                            ${product.price.toFixed(2)}
                        </span>
                    </div>

                    {/* Botón de añadir más prominente al hacer hover */}
                    <button
                        className={cn(
                            "p-2 rounded-lg transition-all duration-200",
                            product.stock <= 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-gray-100 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 group-hover:bg-violet-600 group-hover:text-white"
                        )}
                        disabled={product.stock <= 0}
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// List Card Component
function ProductCardList({ product, onAdd, isFavorite, onToggleFavorite }: { product: PosProduct; onAdd: () => void; isFavorite: boolean; onToggleFavorite: (e: any) => void }) {
    return (
        <Card
            className="cursor-pointer hover:border-violet-500 transition-all active:scale-[0.99] p-3 relative group"
            onClick={onAdd}
        >
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn("h-6 w-6 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800", isFavorite ? "text-amber-500 opacity-100" : "text-gray-400")}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(e);
                    }}
                >
                    <Heart className={cn("h-3 w-3", isFavorite ? "fill-current" : "")} />
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    {product.image ? (
                        <img
                            src={product.image}
                            alt={product.name}
                            className="object-cover w-full h-full rounded-md"
                            loading="lazy"
                        />
                    ) : (
                        <Package className="h-6 w-6 text-gray-400" />
                    )}
                    {product.stock <= 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">AGOTADO</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{product.name}</h3>
                        {product.category && (
                            <Badge variant="outline" className="text-xs shrink-0">
                                {product.category}
                            </Badge>
                        )}
                        {isFavorite && <Heart className="h-3 w-3 text-amber-500 fill-current" />}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                        {product.sku && <span>SKU: {product.sku}</span>}
                        <span className={product.stock <= 0 ? 'text-red-600 font-medium' : ''}>
                            Stock: {product.stock}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-violet-600 dark:text-violet-400">
                        ${product.price.toFixed(2)}
                    </span>
                    <Button
                        size="icon"
                        variant="default"
                        className="h-8 w-8 rounded-full"
                        disabled={product.stock <= 0}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
