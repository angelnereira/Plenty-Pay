import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
    header: string
    accessor: (row: T, index: number) => React.ReactNode
    align?: "left" | "right" | "center"
    width?: string // ej. "w-32"
}

interface DataTableProps<T> {
    columns: DataTableColumn<T>[]
    rows: T[]
    emptyLabel?: string
    rowKey?: (row: T, index: number) => string
}

export function DataTable<T>({
    columns,
    rows,
    emptyLabel = "Sin datos en el período seleccionado",
    rowKey,
}: DataTableProps<T>) {
    if (rows.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                {emptyLabel}
            </div>
        )
    }
    return (
        <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10">
                        {columns.map((c, i) => (
                            <th
                                key={i}
                                className={cn(
                                    "px-5 py-2 font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400",
                                    c.align === "right" && "text-right",
                                    c.align === "center" && "text-center",
                                    c.width,
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, ri) => (
                        <tr
                            key={rowKey ? rowKey(row, ri) : ri}
                            className="border-b border-slate-100 dark:border-white/[0.06] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                        >
                            {columns.map((c, ci) => (
                                <td
                                    key={ci}
                                    className={cn(
                                        "px-5 py-2.5 text-slate-900 dark:text-slate-100 tabular-nums",
                                        c.align === "right" && "text-right",
                                        c.align === "center" && "text-center",
                                    )}
                                >
                                    {c.accessor(row, ri)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
