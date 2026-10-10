"use client";

import { useState } from "react";
import { PaydayEmployee, WorkShift, WorkGroup } from "@prisma/client";
import { Button } from "@/shared/ui/button";
import { DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { createScheduleAssignment } from "@/features/payday/actions/schedule";

type Props = {
    shifts: WorkShift[];
    employees: PaydayEmployee[];
    workGroups: WorkGroup[];
    clientId: string;
}

export function AssignmentForm({ shifts, employees, workGroups, clientId }: Props) {
    const [targetType, setTargetType] = useState<"EMPLOYEE" | "GROUP">("EMPLOYEE");
    const [targetId, setTargetId] = useState("");
    const [shiftId, setShiftId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Default Mon-Fri

    const handleSubmit = async () => {
        if (!shiftId || !targetId || !startDate) {
            alert("Complete los campos obligatorios");
            return;
        }

        const res = await createScheduleAssignment({
            workShiftId: shiftId,
            startDate: new Date(startDate), // Convert string to Date
            endDate: endDate ? new Date(endDate) : null,
            daysOfWeek: daysOfWeek,
            employeeId: targetType === "EMPLOYEE" ? targetId : undefined,
            workGroupId: targetType === "GROUP" ? targetId : undefined,
        });

        if (res.success) {
            alert("Asignación creada");
            // Optional: Close dialog via props callback if controlled by parent
        } else {
            alert(res.error);
        }
    };

    const toggleDay = (d: number) => {
        if (daysOfWeek.includes(d)) {
            setDaysOfWeek(daysOfWeek.filter(x => x !== d));
        } else {
            setDaysOfWeek([...daysOfWeek, d]);
        }
    };

    return (
        <div className="space-y-4 py-2">
            <DialogHeader>
                <DialogTitle>Nueva Asignación de Horario</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Asignar a</Label>
                    <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EMPLOYEE">Empleado Individual</SelectItem>
                            <SelectItem value="GROUP">Grupo de Trabajo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label>{targetType === "EMPLOYEE" ? "Empleado" : "Grupo"}</Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent>
                            {targetType === "EMPLOYEE" ? (
                                employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)
                            ) : (
                                workGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-2">
                <Label>Turno / Horario</Label>
                <Select value={shiftId} onValueChange={setShiftId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleccione turno..." />
                    </SelectTrigger>
                    <SelectContent>
                        {shifts.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                    {s.name} ({s.startTime} - {s.endTime})
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Fecha Inicio</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label>Fecha Fin (Opcional)</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    <p className="text-[10px] text-slate-500">Dejar vacío para indefinido</p>
                </div>
            </div>

            <div className="grid gap-2">
                <Label>Días Aplicables</Label>
                <div className="flex justify-between gap-1">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${daysOfWeek.includes(idx)
                                ? 'bg-blue-600 text-white shadow-md scale-110'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
            </div>

            <Button onClick={handleSubmit} className="w-full mt-2">Crear Asignación</Button>
        </div>
    );
}
