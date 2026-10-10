"use client";

import { useState } from "react";
import { WorkShift } from "@prisma/client";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { createWorkShift, deleteWorkShift, updateWorkShift } from "@/features/payday/actions/shifts";
import { toast } from "@/shared/hooks/use-toast";

export function ShiftsManager({ initialShifts, clientId }: { initialShifts: WorkShift[], clientId: string }) {
    const [shifts, setShifts] = useState(initialShifts); // Optimistic-ish
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Form States
    const [formData, setFormData] = useState({
        name: "",
        startTime: "08:00",
        endTime: "17:00",
        breakDuration: 60,
        gracePeriodMinutes: 15,
        color: "#3b82f6"
    });

    const handleCreate = async () => {
        const res = await createWorkShift({ ...formData, clientId });
        if (res.success && res.data) { // Check for data existence
            setShifts([...shifts, res.data]);
            setIsCreateOpen(false);
            setFormData({ name: "", startTime: "08:00", endTime: "17:00", breakDuration: 60, gracePeriodMinutes: 15, color: "#3b82f6" });
            // toast({ title: "Turno creado" });
        } else {
            alert(res.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este turno?")) return;
        const res = await deleteWorkShift(id);
        if (res.success) {
            setShifts(shifts.filter(s => s.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold">Turnos Definidos</h2>
                    <p className="text-sm text-slate-500">Configura los horarios disponibles para tus empleados.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>+ Nuevo Turno</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Turno</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nombre</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Turno Matutino" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Hora Inicio</Label>
                                    <Input type="time" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Hora Fin</Label>
                                    <Input type="time" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Descanso (min)</Label>
                                    <Input type="number" value={formData.breakDuration} onChange={e => setFormData({ ...formData, breakDuration: parseInt(e.target.value) })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Tolerancia (min)</Label>
                                    <Input type="number" value={formData.gracePeriodMinutes} onChange={e => setFormData({ ...formData, gracePeriodMinutes: parseInt(e.target.value) })} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Color (UI)</Label>
                                <div className="flex gap-2">
                                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c })}
                                            className={`w-8 h-8 rounded-full border-2 ${formData.color === c ? 'border-black dark:border-white' : 'border-transparent'}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <Button onClick={handleCreate} className="w-full">Guardar Turno</Button>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Horario</TableHead>
                            <TableHead>Configuración</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shifts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                    No hay turnos creados.
                                </TableCell>
                            </TableRow>
                        )}
                        {shifts.map((shift) => (
                            <TableRow key={shift.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }} />
                                        {shift.name}
                                    </div>
                                </TableCell>
                                <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                                <TableCell className="text-xs text-slate-500">
                                    <div>Descanso: {shift.breakDuration}m</div>
                                    <div>Tolerancia: {shift.gracePeriodMinutes}m</div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(shift.id)} className="text-red-500 hover:text-red-600">
                                        Eliminar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
