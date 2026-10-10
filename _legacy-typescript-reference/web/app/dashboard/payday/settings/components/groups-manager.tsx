"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { createWorkGroup } from "@/features/payday/actions/groups";

// Simplified type for demonstration
type GroupWithCount = {
    id: string;
    name: string;
    description: string | null;
    _count: { members: number };
};

export function GroupsManager({ initialGroups, clientId }: { initialGroups: GroupWithCount[], clientId: string }) {
    const [groups, setGroups] = useState(initialGroups);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [formData, setFormData] = useState({ name: "", description: "" });

    const handleCreate = async () => {
        const res = await createWorkGroup({ ...formData, clientId });
        if (res.success && res.data) {
            // Adapt the response to match the state type (mocking _count)
            const newGroup = { ...res.data, _count: { members: 0 } };
            setGroups([...groups, newGroup]);
            setIsCreateOpen(false);
            setFormData({ name: "", description: "" });
        } else {
            alert(res.error);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
                <div>
                    <h2 className="text-lg font-semibold">Grupos de Trabajo</h2>
                    <p className="text-sm text-slate-500">Agrupa empleados (ej: Cocina, Barra) para asignar horarios masivamente.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>+ Nuevo Grupo</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Grupo</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nombre del Grupo</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Equipo de Ventas" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Descripción (Opcional)</Label>
                                <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                        </div>
                        <Button onClick={handleCreate} className="w-full">Crear Grupo</Button>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-center">Miembros</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                    No hay grupos definidos.
                                </TableCell>
                            </TableRow>
                        )}
                        {groups.map((group) => (
                            <TableRow key={group.id}>
                                <TableCell className="font-medium">{group.name}</TableCell>
                                <TableCell className="text-slate-500">{group.description || '-'}</TableCell>
                                <TableCell className="text-center">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                        {group._count.members} empleados
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm">Gestionar</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
