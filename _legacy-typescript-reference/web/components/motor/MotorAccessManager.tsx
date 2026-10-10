"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantMotorPanelAccess, revokeMotorPanelAccess } from "@/actions/motor/assignments";

interface GrantedRow {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    clientId: string;
    clientName: string;
    clientSlug: string;
    status: string;
    grantedAt: string;
    revokedAt: string | null;
    notes: string | null;
}

interface SystemUser {
    id: string;
    email: string;
    name: string;
    clientSlug: string;
}

export function MotorAccessManager({ granted, users }: { granted: GrantedRow[]; users: SystemUser[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [targetUserId, setTargetUserId] = useState("");
    const [targetNotes, setTargetNotes] = useState("");

    async function onGrant(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        
        if (!targetUserId) {
            setError("Usuario requerido");
            return;
        }
        
        startTransition(async () => {
            try {
                const grantRes = await grantMotorPanelAccess({
                    targetUserId,
                    notes: targetNotes.trim() || undefined,
                });
                if (!grantRes.success) {
                    setError(grantRes.error || "Error concediendo acceso");
                    return;
                }
                setTargetUserId("");
                setTargetNotes("");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error");
            }
        });
    }

    function onRevoke(targetUserId: string) {
        const reason = prompt("Razón de la revocación (opcional):");
        if (reason === null) return;
        startTransition(async () => {
            const res = await revokeMotorPanelAccess({
                targetUserId,
                reason: reason || undefined,
            });
            if (!res.success) {
                setError(res.error || "Error");
                return;
            }
            router.refresh();
        });
    }

    function onReactivate(targetUserId: string) {
        startTransition(async () => {
            const res = await grantMotorPanelAccess({ targetUserId });
            if (!res.success) {
                setError(res.error || "Error");
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="space-y-6">
            <form
                onSubmit={onGrant}
                className="border rounded-lg p-4 bg-muted/20 space-y-3"
            >
                <h2 className="font-semibold">Conceder acceso al panel</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-sm font-medium">Seleccionar Usuario</span>
                        <select
                            value={targetUserId}
                            onChange={(e) => setTargetUserId(e.target.value)}
                            required
                            className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">—</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name} ({u.email}) - {u.clientSlug}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium">Notas (opcional)</span>
                        <input
                            value={targetNotes}
                            onChange={(e) => setTargetNotes(e.target.value)}
                            className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                        />
                    </label>
                </div>
                {error && (
                    <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md p-2">
                        {error}
                    </div>
                )}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                    >
                        {isPending ? "Procesando..." : "Conceder acceso"}
                    </button>
                </div>
            </form>

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-4 py-2">Usuario</th>
                            <th className="text-left px-4 py-2">Tenant</th>
                            <th className="text-left px-4 py-2">Estado</th>
                            <th className="text-left px-4 py-2">Concedido</th>
                            <th className="text-right px-4 py-2">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {granted.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                    Aún no se ha concedido acceso al panel a ningún usuario.
                                </td>
                            </tr>
                        )}
                        {granted.map((row) => (
                            <tr key={row.id} className="border-t">
                                <td className="px-4 py-3">
                                    <div className="font-medium">{row.userName}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.userEmail}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div>{row.clientName}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {row.clientSlug}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {row.status === "ACTIVE" ? (
                                        <span className="text-green-600 text-xs font-medium">
                                            ACTIVO
                                        </span>
                                    ) : (
                                        <span className="text-amber-600 text-xs font-medium">
                                            REVOCADO
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {row.grantedAt.slice(0, 10)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {row.status === "ACTIVE" ? (
                                        <button
                                            onClick={() => onRevoke(row.userId)}
                                            disabled={isPending}
                                            className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                                        >
                                            Revocar
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => onReactivate(row.userId)}
                                            disabled={isPending}
                                            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                                        >
                                            Reactivar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
