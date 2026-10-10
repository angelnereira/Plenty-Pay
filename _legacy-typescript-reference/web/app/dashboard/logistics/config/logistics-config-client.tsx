"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Truck, Plus, Users, Building2, Phone, Mail, FileText,
    Edit2, Trash2, X, Check, Loader2, ChevronDown, ChevronUp,
    AlertTriangle, Shield, Settings, Save, MapPin
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ──────────────────────────────────────────────
interface Carrier {
    id: string
    name: string
    ruc: string | null
    phone: string | null
    email: string | null
    isActive: boolean
    _count: { drivers: number; deliveryOrders: number }
}

interface Driver {
    id: string
    firstName: string
    lastName: string
    phone: string | null
    licenseNo: string | null
    carrierId: string | null
    isActive: boolean
    carrier: { name: string } | null
    _count: { deliveryOrders: number }
}

// ─── Main Component ─────────────────────────────────────
export function LogisticsConfigClient() {
    const [activeTab, setActiveTab] = useState<'carriers' | 'drivers' | 'defaults'>('defaults')

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase flex items-center gap-3">
                        <Truck className="h-8 w-8 text-rose-500" />
                        Configuración de Logística
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                        Gestiona transportistas, conductores y configuración de envíos.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-white/[0.1] overflow-x-auto scrollbar-hide">
                    {([
                        { key: 'defaults' as const, label: 'Valores por Defecto', icon: Settings },
                        { key: 'carriers' as const, label: 'Transportistas', icon: Building2 },
                        { key: 'drivers' as const, label: 'Conductores', icon: Users },
                    ]).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap",
                                activeTab === tab.key
                                    ? "border-rose-500 text-rose-600 dark:text-rose-400"
                                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            )}
                        >
                            <tab.icon className="h-4 w-4 inline mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'defaults' && <DefaultsManager />}
                {activeTab === 'carriers' && <CarriersManager />}
                {activeTab === 'drivers' && <DriversManager />}
            </div>
        </div>
    )
}

// ─── Defaults Manager ────────────────────────────────────
function DefaultsManager() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [carriers, setCarriers] = useState<Carrier[]>([])
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [form, setForm] = useState({
        // Transport
        defaultCarrierId: '',
        defaultDriverId: '',
        defaultVehiclePlate: '',
        defaultInsurancePolicy: '',
        // Conditions
        defaultShippingMode: 'Terrestre',
        defaultIncoterm: '',
        defaultPackaging: 'Unidad',
        defaultPriority: 'Normal',
        defaultControlledTemp: false,
        defaultHazardousMat: false,
        // Sender
        senderName: '',
        senderPhone: '',
        senderAddress: '',
        // Notes
        defaultNotes: '',
    })

    useEffect(() => {
        async function load() {
            try {
                const [configRes, carriersRes, driversRes] = await Promise.all([
                    fetch('/api/logistics/config'),
                    fetch('/api/logistics/carriers'),
                    fetch('/api/logistics/drivers'),
                ])
                if (configRes.ok) {
                    const defaults = await configRes.json()
                    setForm(f => ({ ...f, ...defaults }))
                }
                if (carriersRes.ok) setCarriers(await carriersRes.json())
                if (driversRes.ok) setDrivers(await driversRes.json())
            } catch {
                toast.error('Error al cargar configuración')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/logistics/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    defaultCarrierId: form.defaultCarrierId || null,
                    defaultDriverId: form.defaultDriverId || null,
                }),
            })
            if (!res.ok) throw new Error()
            toast.success('Configuración guardada')
        } catch {
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    // Filter drivers by selected carrier
    const filteredDrivers = form.defaultCarrierId
        ? drivers.filter(d => d.carrierId === form.defaultCarrierId || !d.carrierId)
        : drivers

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        )
    }

    const inputClass = "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
    const labelClass = "text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block"

    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                Configura valores que se llenarán automáticamente al crear nuevas órdenes de entrega.
            </p>

            {/* Sender / Company Info */}
            <div className="premium-card p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    Datos del Remitente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className={labelClass}>Nombre / Empresa</label>
                        <input value={form.senderName} onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} placeholder="Mi Empresa S.A." className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Teléfono</label>
                        <input value={form.senderPhone} onChange={e => setForm(f => ({ ...f, senderPhone: e.target.value }))} placeholder="+507 200-0000" className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Dirección de Origen</label>
                        <input value={form.senderAddress} onChange={e => setForm(f => ({ ...f, senderAddress: e.target.value }))} placeholder="Calle 50, Ciudad de Panamá" className={inputClass} />
                    </div>
                </div>
            </div>

            {/* Default Transport */}
            <div className="premium-card p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck className="h-4 w-4 text-rose-500" />
                    Transporte por Defecto
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Transportista</label>
                        <select
                            value={form.defaultCarrierId}
                            onChange={e => setForm(f => ({ ...f, defaultCarrierId: e.target.value, defaultDriverId: '' }))}
                            className={inputClass}
                        >
                            <option value="">Sin asignar</option>
                            {carriers.filter(c => c.isActive).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Conductor</label>
                        <select
                            value={form.defaultDriverId}
                            onChange={e => setForm(f => ({ ...f, defaultDriverId: e.target.value }))}
                            className={inputClass}
                        >
                            <option value="">Sin asignar</option>
                            {filteredDrivers.filter(d => d.isActive).map(d => (
                                <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Placa del Vehículo</label>
                        <input value={form.defaultVehiclePlate} onChange={e => setForm(f => ({ ...f, defaultVehiclePlate: e.target.value }))} placeholder="ABC-1234" className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Póliza de Seguro</label>
                        <input value={form.defaultInsurancePolicy} onChange={e => setForm(f => ({ ...f, defaultInsurancePolicy: e.target.value }))} placeholder="Número de póliza" className={inputClass} />
                    </div>
                </div>
            </div>

            {/* Default Conditions */}
            <div className="premium-card p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
                    <Settings className="h-4 w-4 text-rose-500" />
                    Condiciones por Defecto
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className={labelClass}>Modo de Envío</label>
                        <select value={form.defaultShippingMode} onChange={e => setForm(f => ({ ...f, defaultShippingMode: e.target.value }))} className={inputClass}>
                            <option value="Terrestre">Terrestre</option>
                            <option value="Aéreo">Aéreo</option>
                            <option value="Marítimo">Marítimo</option>
                            <option value="Multimodal">Multimodal</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Prioridad</label>
                        <select value={form.defaultPriority} onChange={e => setForm(f => ({ ...f, defaultPriority: e.target.value }))} className={inputClass}>
                            <option value="Baja">Baja</option>
                            <option value="Normal">Normal</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">Urgente</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Empaque por Defecto</label>
                        <select value={form.defaultPackaging} onChange={e => setForm(f => ({ ...f, defaultPackaging: e.target.value }))} className={inputClass}>
                            <option value="Unidad">Unidad</option>
                            <option value="Caja">Caja</option>
                            <option value="Bolsa">Bolsa</option>
                            <option value="Pallet">Pallet</option>
                            <option value="Servicio">Servicio</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Incoterm</label>
                        <input value={form.defaultIncoterm} onChange={e => setForm(f => ({ ...f, defaultIncoterm: e.target.value }))} placeholder="DAP, CIF, FOB..." className={inputClass} />
                    </div>
                </div>
                <div className="flex gap-6 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.defaultControlledTemp}
                            onChange={e => setForm(f => ({ ...f, defaultControlledTemp: e.target.checked }))}
                            className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Temperatura controlada</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.defaultHazardousMat}
                            onChange={e => setForm(f => ({ ...f, defaultHazardousMat: e.target.checked }))}
                            className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Material peligroso</span>
                    </label>
                </div>
            </div>

            {/* Default Notes */}
            <div className="premium-card p-6 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-rose-500" />
                    Notas por Defecto
                </h3>
                <textarea
                    value={form.defaultNotes}
                    onChange={e => setForm(f => ({ ...f, defaultNotes: e.target.value }))}
                    placeholder="Instrucciones de entrega que se agregarán automáticamente a cada nueva orden..."
                    rows={3}
                    className={cn(inputClass, "resize-none")}
                />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar Configuración
                </button>
            </div>
        </div>
    )
}

// ─── Carriers Manager ───────────────────────────────────
function CarriersManager() {
    const [carriers, setCarriers] = useState<Carrier[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({ name: '', ruc: '', phone: '', email: '' })
    const [saving, setSaving] = useState(false)

    const fetchCarriers = useCallback(async () => {
        try {
            const res = await fetch('/api/logistics/carriers')
            if (res.ok) setCarriers(await res.json())
        } catch {
            toast.error('Error al cargar transportistas')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchCarriers() }, [fetchCarriers])

    const resetForm = () => {
        setForm({ name: '', ruc: '', phone: '', email: '' })
        setShowForm(false)
        setEditingId(null)
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('El nombre es requerido')
            return
        }
        setSaving(true)
        try {
            if (editingId) {
                const res = await fetch(`/api/logistics/carriers/${editingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) throw new Error()
                toast.success('Transportista actualizado')
            } else {
                const res = await fetch('/api/logistics/carriers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                })
                if (!res.ok) throw new Error()
                toast.success('Transportista creado')
            }
            resetForm()
            fetchCarriers()
        } catch {
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (carrier: Carrier) => {
        setForm({
            name: carrier.name,
            ruc: carrier.ruc || '',
            phone: carrier.phone || '',
            email: carrier.email || '',
        })
        setEditingId(carrier.id)
        setShowForm(true)
    }

    const handleToggleActive = async (carrier: Carrier) => {
        try {
            const res = await fetch(`/api/logistics/carriers/${carrier.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !carrier.isActive }),
            })
            if (!res.ok) throw new Error()
            toast.success(carrier.isActive ? 'Desactivado' : 'Activado')
            fetchCarriers()
        } catch {
            toast.error('Error al actualizar')
        }
    }

    const handleDelete = async (carrier: Carrier) => {
        if (!confirm(`¿Eliminar transportista "${carrier.name}"?`)) return
        try {
            const res = await fetch(`/api/logistics/carriers/${carrier.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            const data = await res.json()
            if (data.deactivated) {
                toast.info('Transportista desactivado (tiene órdenes asociadas)')
            } else {
                toast.success('Transportista eliminado')
            }
            fetchCarriers()
        } catch {
            toast.error('Error al eliminar')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Add Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => { resetForm(); setShowForm(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-rose-500/20"
                >
                    <Plus size={18} />
                    Nuevo Transportista
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="premium-card p-6 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
                        {editingId ? 'Editar Transportista' : 'Nuevo Transportista'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Nombre *
                            </label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Nombre de la empresa"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                RUC
                            </label>
                            <input
                                value={form.ruc}
                                onChange={e => setForm(f => ({ ...f, ruc: e.target.value }))}
                                placeholder="RUC del transportista"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Teléfono
                            </label>
                            <input
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+507 6000-0000"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Email
                            </label>
                            <input
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="contacto@empresa.com"
                                type="email"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'Guardar Cambios' : 'Crear'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {carriers.length === 0 ? (
                <div className="premium-card p-12 text-center">
                    <Building2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No hay transportistas registrados</p>
                    <p className="text-xs text-gray-400 mt-1">Agrega un transportista para asignarlos a tus órdenes de entrega</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {carriers.map(carrier => (
                        <div key={carrier.id} className={cn(
                            "premium-card p-5 flex flex-col md:flex-row md:items-center gap-4 transition-opacity",
                            !carrier.isActive && "opacity-60"
                        )}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white truncate">{carrier.name}</h4>
                                    {!carrier.isActive && (
                                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                            Inactivo
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                    {carrier.ruc && <span className="flex items-center gap-1"><FileText size={12} />{carrier.ruc}</span>}
                                    {carrier.phone && <span className="flex items-center gap-1"><Phone size={12} />{carrier.phone}</span>}
                                    {carrier.email && <span className="flex items-center gap-1"><Mail size={12} />{carrier.email}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                                <span>{carrier._count.drivers} conductores</span>
                                <span>{carrier._count.deliveryOrders} órdenes</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => handleEdit(carrier)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400 hover:text-blue-500 transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleToggleActive(carrier)} className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    carrier.isActive
                                        ? "hover:bg-amber-50 dark:hover:bg-amber-900/10 text-gray-400 hover:text-amber-500"
                                        : "hover:bg-green-50 dark:hover:bg-green-900/10 text-gray-400 hover:text-green-500"
                                )}>
                                    {carrier.isActive ? <AlertTriangle size={16} /> : <Check size={16} />}
                                </button>
                                <button onClick={() => handleDelete(carrier)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Drivers Manager ────────────────────────────────────
function DriversManager() {
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [carriers, setCarriers] = useState<Carrier[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', licenseNo: '', carrierId: '' })
    const [saving, setSaving] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const [driversRes, carriersRes] = await Promise.all([
                fetch('/api/logistics/drivers'),
                fetch('/api/logistics/carriers'),
            ])
            if (driversRes.ok) setDrivers(await driversRes.json())
            if (carriersRes.ok) setCarriers(await carriersRes.json())
        } catch {
            toast.error('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const resetForm = () => {
        setForm({ firstName: '', lastName: '', phone: '', licenseNo: '', carrierId: '' })
        setShowForm(false)
        setEditingId(null)
    }

    const handleSave = async () => {
        if (!form.firstName.trim() || !form.lastName.trim()) {
            toast.error('Nombre y apellido son requeridos')
            return
        }
        setSaving(true)
        try {
            const payload = {
                ...form,
                carrierId: form.carrierId || null,
            }
            if (editingId) {
                const res = await fetch(`/api/logistics/drivers/${editingId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error()
                toast.success('Conductor actualizado')
            } else {
                const res = await fetch('/api/logistics/drivers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error()
                toast.success('Conductor creado')
            }
            resetForm()
            fetchData()
        } catch {
            toast.error('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (driver: Driver) => {
        setForm({
            firstName: driver.firstName,
            lastName: driver.lastName,
            phone: driver.phone || '',
            licenseNo: driver.licenseNo || '',
            carrierId: driver.carrierId || '',
        })
        setEditingId(driver.id)
        setShowForm(true)
    }

    const handleToggleActive = async (driver: Driver) => {
        try {
            const res = await fetch(`/api/logistics/drivers/${driver.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !driver.isActive }),
            })
            if (!res.ok) throw new Error()
            toast.success(driver.isActive ? 'Desactivado' : 'Activado')
            fetchData()
        } catch {
            toast.error('Error al actualizar')
        }
    }

    const handleDelete = async (driver: Driver) => {
        if (!confirm(`¿Eliminar conductor "${driver.firstName} ${driver.lastName}"?`)) return
        try {
            const res = await fetch(`/api/logistics/drivers/${driver.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            const data = await res.json()
            if (data.deactivated) {
                toast.info('Conductor desactivado (tiene órdenes asociadas)')
            } else {
                toast.success('Conductor eliminado')
            }
            fetchData()
        } catch {
            toast.error('Error al eliminar')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Add Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => { resetForm(); setShowForm(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-rose-500/20"
                >
                    <Plus size={18} />
                    Nuevo Conductor
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="premium-card p-6 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">
                        {editingId ? 'Editar Conductor' : 'Nuevo Conductor'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Nombre *
                            </label>
                            <input
                                value={form.firstName}
                                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                                placeholder="Nombre"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Apellido *
                            </label>
                            <input
                                value={form.lastName}
                                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                                placeholder="Apellido"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Teléfono
                            </label>
                            <input
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+507 6000-0000"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                No. Licencia
                            </label>
                            <input
                                value={form.licenseNo}
                                onChange={e => setForm(f => ({ ...f, licenseNo: e.target.value }))}
                                placeholder="Número de licencia"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                                Transportista Asignado
                            </label>
                            <select
                                value={form.carrierId}
                                onChange={e => setForm(f => ({ ...f, carrierId: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.06] text-sm focus:ring-2 focus:ring-rose-500 transition-all"
                            >
                                <option value="">Sin asignar (independiente)</option>
                                {carriers.filter(c => c.isActive).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'Guardar Cambios' : 'Crear'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {drivers.length === 0 ? (
                <div className="premium-card p-12 text-center">
                    <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No hay conductores registrados</p>
                    <p className="text-xs text-gray-400 mt-1">Agrega conductores para asignarlos a tus órdenes de entrega</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {drivers.map(driver => (
                        <div key={driver.id} className={cn(
                            "premium-card p-5 flex flex-col md:flex-row md:items-center gap-4 transition-opacity",
                            !driver.isActive && "opacity-60"
                        )}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-gray-900 dark:text-white truncate">
                                        {driver.firstName} {driver.lastName}
                                    </h4>
                                    {!driver.isActive && (
                                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                                            Inactivo
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                    {driver.carrier && (
                                        <span className="flex items-center gap-1">
                                            <Building2 size={12} />{driver.carrier.name}
                                        </span>
                                    )}
                                    {driver.phone && <span className="flex items-center gap-1"><Phone size={12} />{driver.phone}</span>}
                                    {driver.licenseNo && <span className="flex items-center gap-1"><Shield size={12} />Lic: {driver.licenseNo}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                                <span>{driver._count.deliveryOrders} órdenes</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => handleEdit(driver)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400 hover:text-blue-500 transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleToggleActive(driver)} className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    driver.isActive
                                        ? "hover:bg-amber-50 dark:hover:bg-amber-900/10 text-gray-400 hover:text-amber-500"
                                        : "hover:bg-green-50 dark:hover:bg-green-900/10 text-gray-400 hover:text-green-500"
                                )}>
                                    {driver.isActive ? <AlertTriangle size={16} /> : <Check size={16} />}
                                </button>
                                <button onClick={() => handleDelete(driver)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
