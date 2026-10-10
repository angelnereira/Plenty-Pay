"use client";

import { useState, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@shared/ui/dialog";
import { BarChart, Activity, TrendingUp, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";

import { Loader2 } from "lucide-react";

interface DailyStats {
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
    topProducts: { name: string, quantity: number, revenue: number }[];
}

export function PosAnalyticsWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<DailyStats | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // In a real app, this would call the server action. 
            // For now, let's simulate or try to call if it existed, 
            // but since I haven't created the action yet, I'll mock it 
            // OR I will create the action in the next step. 
            // I'll assume the action exists or I will create it.
            // Let's create the action first? No, I'll scaffold the component.

            // Mock data for immediate feedback
            setTimeout(() => {
                setStats({
                    totalSales: 1250.50,
                    transactionCount: 45,
                    averageTicket: 27.79,
                    topProducts: [
                        { name: "Producto A", quantity: 12, revenue: 120.00 },
                        { name: "Producto B", quantity: 8, revenue: 95.50 },
                        { name: "Producto C", quantity: 5, revenue: 50.00 },
                    ]
                });
                setLoading(false);
            }, 1000);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchStats();
            // Polling every minute
            const interval = setInterval(fetchStats, 60000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Activity className="h-4 w-4" />
                    <span className="hidden sm:inline">Reporte</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-violet-600" />
                        Reporte de Ventas en Tiempo Real (Hoy)
                    </DialogTitle>
                </DialogHeader>

                {loading && !stats ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${stats?.totalSales.toFixed(2)}</div>
                                    <p className="text-xs text-muted-foreground">+20.1% vs ayer</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                                    <BarChart className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats?.transactionCount}</div>
                                    <p className="text-xs text-muted-foreground">+180 desde ultima hora</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${stats?.averageTicket.toFixed(2)}</div>
                                    <p className="text-xs text-muted-foreground">+19% vs promedio</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Top Products */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Productos Más Vendidos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {stats?.topProducts.map((product, i) => (
                                        <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{product.name}</span>
                                                <span className="text-xs text-muted-foreground">{product.quantity} unidades</span>
                                            </div>
                                            <div className="font-bold text-sm">
                                                ${product.revenue.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
