export function ComplianceItem({ label, value, status }: any) {
    const color = status === 'good' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-500';
    return (
        <div className="flex items-center justify-between group">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{label}</span>
            <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-900 dark:text-white">{value}</span>
                <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm ring-2 ring-white dark:ring-white/[0.06]`} />
            </div>
        </div>
    )
}
