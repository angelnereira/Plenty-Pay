"use client";

import { usePosStore, PosProduct } from "../stores/pos.store";
import { Card } from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Search, Package, Plus, ScanBarcode, Check } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import { CategoryFilter } from "./CategoryFilter";
import { useToast } from "@shared/hooks/use-toast";
import { cn } from "@/lib/utils";
import "./pos-mobile.css";

interface MobileProductGridProps {
    initialProducts: PosProduct[];
    onScanRequest: () => void;
}

export function MobileProductGrid({ initialProducts, onScanRequest }: MobileProductGridProps) {
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [addedId, setAddedId] = useState<string | null>(null);

    const addToCart = usePosStore(state => state.addToCart);
    const filters = usePosStore(state => state.filters);
    const setCategories = usePosStore(state => state.setCategories);

    const { toast } = useToast();

    // Extract categories
    useEffect(() => {
        const uniqueCategories = Array.from(
            new Set(initialProducts.map(p => p.category).filter(Boolean))
        ) as string[];
        setCategories(uniqueCategories);
    }, [initialProducts, setCategories]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Handle quick add feedback
    const handleAdd = (product: PosProduct) => {
        addToCart(product);
        setAddedId(product.id);

        // Tactile feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        setTimeout(() => setAddedId(null), 500);
    };

    const filteredProducts = useMemo(() => {
        let products = initialProducts;

        if (debouncedSearch) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                p.sku?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                p.barcode?.toLowerCase().includes(debouncedSearch.toLowerCase())
            );
        }

        if (filters.category) {
            products = products.filter(p => p.category === filters.category);
        }

        return products;
    }, [initialProducts, debouncedSearch, filters.category]);

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-transparent">
            {/* Sticky Header with Search */}
            <div className="sticky top-0 z-40 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border-b dark:border-white/[0.1] p-4 space-y-3">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar..."
                            className="pl-9 bg-white dark:bg-white/[0.04] h-11 rounded-xl shadow-sm border-gray-200 dark:border-white/[0.08] font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button
                        size="icon"
                        variant="default"
                        className="h-11 w-11 rounded-xl shadow-sm bg-violet-600 hover:bg-violet-700"
                        onClick={onScanRequest}
                    >
                        <ScanBarcode className="h-5 w-5" />
                    </Button>
                </div>

                {/* Horizontal Category Filter */}
                <CategoryFilter variant="horizontal" className="pt-1" />
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 content-start">
                <div className="grid grid-cols-2 gap-3 pb-24">
                    {filteredProducts.map(product => {
                        const isAdded = addedId === product.id;

                        return (
                            <Card
                                key={product.id}
                                className={cn(
                                    "border-0 shadow-sm overflow-hidden flex flex-col active:scale-[0.98] transition-all duration-200 touch-manipulation",
                                    isAdded ? "ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-900/20" : "bg-white dark:bg-white/[0.06]"
                                )}
                                onClick={() => handleAdd(product)}
                            >
                                <div className="aspect-[4/3] relative bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
                                    {product.image ? (
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="object-cover w-full h-full"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <Package className="h-8 w-8 text-gray-400" />
                                    )}

                                    {isAdded && (
                                        <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center animate-in fade-in zoom-in duration-200">
                                            <div className="bg-white rounded-full p-2 shadow-lg">
                                                <Check className="h-5 w-5 text-violet-600" />
                                            </div>
                                        </div>
                                    )}

                                    {product.stock <= 0 && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <Badge variant="destructive" className="font-bold">AGOTADO</Badge>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 flex-1 flex flex-col">
                                    <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-1 flex-1">
                                        {product.name}
                                    </h3>

                                    <div className="flex items-end justify-between mt-auto">
                                        <div className="text-xs text-muted-foreground">
                                            Stock: {product.stock}
                                        </div>
                                        <span className="font-bold text-violet-600 dark:text-violet-400">
                                            ${product.price.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}

                    {filteredProducts.length === 0 && (
                        <div className="col-span-full py-12 text-center">
                            <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-muted-foreground font-medium">No se encontraron productos</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
