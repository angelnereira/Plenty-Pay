"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    createFieldDefinition,
    deactivateFieldDefinition,
} from "@/actions/motor/schema";
import { suggestSlugFromLabel } from "@/lib/motor/slug";
import type { MotorFieldType, MotorFieldKindScope } from "@prisma/client";

interface DefRow {
    id: string;
    slug: string;
    label: string;
    type: MotorFieldType;
    required: boolean;
    options: { value: string; label: string }[] | null;
    kindScope: MotorFieldKindScope;
    isActive: boolean;
    sortOrder: number;
    notes: string | null;
}

const TYPE_LABEL: Record<MotorFieldType, string> = {
    TEXT: "Texto",
    NUMBER: "Número",
    DATE: "Fecha",
    BOOLEAN: "Sí/No",
    SELECT: "Selección",
};

const SCOPE_LABEL: Record<MotorFieldKindScope, string> = {
    BOTH: "Ambas",
    PERSON: "Personas",
    COMPANY: "Empresas",
};

export function SchemaBuilder({ initial }: { initial: DefRow[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [showCreate, setShowCreate] = useState(false);
    const [label, setLabel] = useState("");
    const [slug, setSlug] = useState("");
    const [type, setType] = useState<MotorFieldType>("TEXT");
    const [required, setRequired] = useState(false);
    const [kindScope, setKindScope] = useState<MotorFieldKindScope>("BOTH");
    const [notes, setNotes] = useState("");
    const [optionsRaw, setOptionsRaw] = useState("");

    function onLabelChange(v: string) {
        setLabel(v);
        if (!slug || slug === suggestSlugFromLabel(label)) {
            setSlug(suggestSlugFromLabel(v));
        }
    }

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!label.trim() || !slug.trim()) {
            setError("Label y slug son requeridos");
            return;
        }
        let parsedOptions: { value: string; label: string }[] | undefined;
        if (type === "SELECT") {
            parsedOptions = optionsRaw
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                    const [value, lbl] = line.split("|").map((s) => s.trim());
                    return { value, label: lbl || value };
                });
            if (parsedOptions.length === 0) {
                setError("SELECT requiere al menos una opción (formato: value|label por línea)");
                return;
            }
        }

        startTransition(async () => {
            const res = await createFieldDefinition({
                slug: slug.trim(),
                label: label.trim(),
                type,
                required,
                kindScope,
                notes: notes.trim() || undefined,
                options: parsedOptions,
            });
            if (!res.success) {
                setError(res.error || "Error creando campo");
                return;
            }
            setLabel("");
            setSlug("");
            setNotes("");
            setOptionsRaw("");
            setRequired(false);
            setShowCreate(false);
            router.refresh();
        });
    }

    async function onDeactivate(id: string) {
        if (!confirm("¿Desactivar este campo? Los datos existentes se conservan.")) return;
        startTransition(async () => {
            const res = await deactivateFieldDefinition({ id });
            if (!res.success) {
                setError(res.error || "Error desactivando");
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={() => setShowCreate((s) => !s)}
                    className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md"
                >
                    {showCreate ? "Cancelar" : "+ Nuevo campo"}
                </button>
            </div>

            {showCreate && (
                <form onSubmit={onCreate} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-sm font-medium">Etiqueta</span>
                            <input
                                value={label}
                                onChange={(e) => onLabelChange(e.target.value)}
                                required
                                className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">
                                Slug (snake_case, inmutable después de uso)
                            </span>
                            <input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                pattern="[a-z][a-z0-9_]*[a-z0-9]"
                                required
                                className="block w-full mt-1 border rounded-md px-3 py-2 text-sm font-mono"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">Tipo</span>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value as MotorFieldType)}
                                className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                            >
                                {(Object.keys(TYPE_LABEL) as MotorFieldType[]).map((t) => (
                                    <option key={t} value={t}>
                                        {TYPE_LABEL[t]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium">Aplica a</span>
                            <select
                                value={kindScope}
                                onChange={(e) =>
                                    setKindScope(e.target.value as MotorFieldKindScope)
                                }
                                className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                            >
                                {(Object.keys(SCOPE_LABEL) as MotorFieldKindScope[]).map((s) => (
                                    <option key={s} value={s}>
                                        {SCOPE_LABEL[s]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                        />
                        <span className="text-sm">Campo requerido</span>
                    </label>
                    {type === "SELECT" && (
                        <label className="block">
                            <span className="text-sm font-medium">
                                Opciones (una por línea, formato: <code>value|label</code>)
                            </span>
                            <textarea
                                value={optionsRaw}
                                onChange={(e) => setOptionsRaw(e.target.value)}
                                rows={5}
                                placeholder="bronze|Bronce&#10;silver|Plata&#10;gold|Oro"
                                className="block w-full mt-1 border rounded-md px-3 py-2 text-sm font-mono"
                            />
                        </label>
                    )}
                    <label className="block">
                        <span className="text-sm font-medium">Notas (opcional)</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="block w-full mt-1 border rounded-md px-3 py-2 text-sm"
                        />
                    </label>
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
                            {isPending ? "Creando..." : "Crear campo"}
                        </button>
                    </div>
                </form>
            )}

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="text-left px-3 py-2">Etiqueta</th>
                            <th className="text-left px-3 py-2">Slug</th>
                            <th className="text-left px-3 py-2">Tipo</th>
                            <th className="text-left px-3 py-2">Alcance</th>
                            <th className="text-center px-3 py-2">Requerido</th>
                            <th className="text-center px-3 py-2">Estado</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {initial.length === 0 && (
                            <tr>
                                <td colSpan={7} className="text-center py-6 text-muted-foreground">
                                    Aún no hay campos personalizados.
                                </td>
                            </tr>
                        )}
                        {initial.map((d) => (
                            <tr key={d.id} className="border-t">
                                <td className="px-3 py-2 font-medium">{d.label}</td>
                                <td className="px-3 py-2 font-mono text-xs">{d.slug}</td>
                                <td className="px-3 py-2">{TYPE_LABEL[d.type]}</td>
                                <td className="px-3 py-2">{SCOPE_LABEL[d.kindScope]}</td>
                                <td className="px-3 py-2 text-center">
                                    {d.required ? "Sí" : "—"}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {d.isActive ? (
                                        <span className="text-green-600 text-xs">Activo</span>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">
                                            Inactivo
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {d.isActive && (
                                        <button
                                            onClick={() => onDeactivate(d.id)}
                                            disabled={isPending}
                                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                                        >
                                            Desactivar
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
