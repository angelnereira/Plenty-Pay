"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@shared/ui/card"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { Label } from "@shared/ui/label"
import {
    User,
    Mail,
    Phone,
    Calendar,
    DollarSign,
    Clock,
    Save,
    Loader2,
    QrCode,
    Fingerprint
} from "lucide-react"
import { toast } from "sonner"
export default function NewEmployeePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        cedula: "",
        position: "",
        department: "",
        hourlyRate: "",
        weeklyHours: "40",
        startDate: new Date().toISOString().split('T')[0]
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            console.log('[NEW_EMPLOYEE] Submitting:', formData)

            const response = await fetch("/api/payday/employees/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })

            const data = await response.json()

            if (response.ok) {
                toast.success(`Empleado creado! ID: ${data.employee.employeeId}`)
                router.push(`/dashboard/payday/employees/${data.employee.id}`)
            } else {
                throw new Error(data.error || "Error al crear empleado")
            }
        } catch (error) {
            console.error('[NEW_EMPLOYEE] Error:', error)
            toast.error(error instanceof Error ? error.message : "Error al crear empleado")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                    Agregar Nuevo Empleado
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                    Complete la información del empleado. Se generará automáticamente su ID, PIN y QR de acceso.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <User className="h-5 w-5 text-violet-500" />
                        Información Personal
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="firstName">Nombre *</Label>
                            <Input
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                                placeholder="Juan"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="lastName">Apellido *</Label>
                            <Input
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                                placeholder="Pérez"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="cedula">Cédula *</Label>
                            <Input
                                id="cedula"
                                name="cedula"
                                value={formData.cedula}
                                onChange={handleChange}
                                required
                                placeholder="8-123-4567"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="juan.perez@empresa.com"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="6123-4567"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="startDate">Fecha de Inicio *</Label>
                            <Input
                                id="startDate"
                                name="startDate"
                                type="date"
                                value={formData.startDate}
                                onChange={handleChange}
                                required
                                className="mt-1"
                            />
                        </div>
                    </div>
                </Card>

                {/* Job Information */}
                <Card className="p-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        Información Laboral
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="position">Cargo *</Label>
                            <Input
                                id="position"
                                name="position"
                                value={formData.position}
                                onChange={handleChange}
                                required
                                placeholder="Vendedor"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="department">Departamento</Label>
                            <Input
                                id="department"
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                placeholder="Ventas"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="hourlyRate">Tarifa por Hora ($/h) *</Label>
                            <div className="relative mt-1">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    id="hourlyRate"
                                    name="hourlyRate"
                                    type="number"
                                    step="0.01"
                                    value={formData.hourlyRate}
                                    onChange={handleChange}
                                    required
                                    placeholder="5.00"
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="weeklyHours">Horas Semanales Contratadas *</Label>
                            <Input
                                id="weeklyHours"
                                name="weeklyHours"
                                type="number"
                                value={formData.weeklyHours}
                                onChange={handleChange}
                                required
                                placeholder="40"
                                className="mt-1"
                            />
                        </div>
                    </div>
                </Card>

                {/* Biometric Setup Info */}
                <Card className="p-6 bg-slate-50 dark:bg-white/[0.04]">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Fingerprint className="h-5 w-5 text-emerald-500" />
                        Configuración de Acceso
                    </h2>
                    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-start gap-3">
                            <QrCode className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">QR de Acceso</p>
                                <p>Se generará automáticamente un código QR único para registro biométrico</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">ID de Empleado</p>
                                <p>Se asignará automáticamente un ID único y PIN de 4 dígitos</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Fingerprint className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">Registro Biométrico</p>
                                <p>El empleado podrá configurar su huella dactilar en el kiosco después del registro</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Actions */}
                <div className="flex gap-4 justify-end pt-4 border-t border-slate-200 dark:border-white/[0.1]">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Crear Empleado
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
