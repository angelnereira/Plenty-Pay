"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantLoyalty, redeemLoyalty } from "@/actions/motor/loyalty";
import { toCents, formatCents } from "@/lib/motor/money";

interface Props {
    entityId: string;
    availablePointsCents: string;
}

export function LoyaltyForm({ entityId, availablePointsCents }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<"GRANT" | "REDEEM">("GRANT");
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const available = BigInt(availablePointsCents);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!amount.trim()) {
            setError("Monto requerido");
            return;
        }
        let amountCents: string;
        try {
            amountCents = toCents(amount.trim()).toString();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Monto inválido");
            return;
        }

        startTransition(async () => {
            const fn = mode === "GRANT" ? grantLoyalty : redeemLoyalty;
            const res = await fn({
                entityId,
                amountCents,
                description: description.trim() || undefined,
            });
            if (!res.success) {
                setError(res.error || "Error en operación de lealtad");
                return;
            }
            setAmount("");
            setDescription("");
            router.refresh();
        });
    }

    return (
        <form onSubmit={onSubmit} className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">Operar puntos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                    <span className="text-sm font-medium">Operación</span>
                    <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as "GRANT" | "REDEEM")}
                        className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    >
                        <option value="GRANT">Otorgar puntos</option>
                        <option value="REDEEM">Redimir puntos</option>
                    </select>
                </label>
                <label className="block">
                    <span className="text-sm font-medium">Monto (B/.)</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                </label>
                <label className="block">
                    <span className="text-sm font-medium">Descripción</span>
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Opcional"
                        className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                    />
                </label>
            </div>
            {mode === "REDEEM" && (
                <p className="text-xs text-muted-foreground">
                    Disponible: {formatCents(available, { withCurrency: true })}
                </p>
            )}
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
                    {isPending ? "Procesando..." : mode === "GRANT" ? "Otorgar" : "Redimir"}
                </button>
            </div>
        </form>
    );
}
