import { prisma } from "@core/database/prisma"
import { Badge } from "@shared/ui/badge"
import { Button } from "@shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@shared/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs"
import { User, Clock } from "lucide-react"
import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import FaceRegistrationSection from "./FaceRegistrationWrapper"

import { BiometricEnrollment } from "@/features/payday/components/biometric-enrollment"

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const resolvedParams = await params;

    if (!session) {
        redirect('/auth/signin');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user?.id },
        include: { client: true }
    });

    if (!user?.client) {
        redirect('/dashboard');
    }

    // Module access check - only allow if paydayEnabled or user is SUPER_ADMIN
    if (!user.client.paydayEnabled && session.user?.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-full mb-6">
                    <Clock className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Módulo no disponible
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    El módulo de nómina no está habilitado para su plan actual.
                    Contacte con soporte para activarlo.
                </p>
                <Link
                    href="/dashboard"
                    className="text-violet-600 hover:text-violet-700 font-medium"
                >
                    Volver al Inicio
                </Link>
            </div>
        );
    }

    const employee = await prisma.paydayEmployee.findUnique({
        where: { id: resolvedParams.id },
        include: { shifts: { orderBy: { checkIn: 'desc' }, take: 5 } }
    });

    if (!employee) return <div>Empleado no encontrado</div>;

    return (
        <div className="p-8 space-y-8 bg-slate-50 dark:bg-transparent min-h-screen">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-white/[0.05] flex items-center justify-center text-xl font-bold text-slate-600 dark:text-slate-300">
                        {employee.firstName[0]}{employee.lastName[0]}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{employee.firstName} {employee.lastName}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge>{employee.contractType}</Badge>
                            <span className="text-slate-500 dark:text-slate-400 text-sm">Cédula: {employee.cedula}</span>
                        </div>
                    </div>
                </div>
                <Button variant="outline">Editar Perfil</Button>
            </div>

            <Tabs defaultValue="credentials" className="w-full">
                <TabsList>
                    <TabsTrigger value="credentials">Credenciales de Acceso</TabsTrigger>
                    <TabsTrigger value="contract">Contrato</TabsTrigger>
                    <TabsTrigger value="history">Historial</TabsTrigger>
                </TabsList>

                <TabsContent value="credentials" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Face ID (Legacy/TensorFlow) */}
                        <Card className="md:col-span-2 border-indigo-100 bg-indigo-50/30 dark:bg-indigo-950/20 dark:border-indigo-500/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-400"><User className="w-5 h-5" /> Reconocimiento Facial</CardTitle>
                                <CardDescription>Escaneo facial para entrada sin contacto - Registro de 3 ángulos.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FaceRegistrationSection
                                    employeeId={employee.id}
                                    hasExistingFace={!!employee.faceIdHash}
                                />
                            </CardContent>
                        </Card>

                        {/* WebAuthn / Passkeys Setup */}
                        <div className="md:col-span-2">
                            <BiometricEnrollment
                                employeeId={employee.id}
                                firstName={employee.firstName}
                                clientId={user.client.id}
                            />
                        </div>

                    </div>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader><CardTitle>Últimos 5 Turnos</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {employee.shifts.map(shift => (
                                    <div key={shift.id} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-100 dark:border-white/[0.08]">
                                        <div>
                                            <div className="font-medium dark:text-white">{shift.shiftDate.toLocaleDateString()}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                {shift.checkIn.toLocaleTimeString()} - {shift.checkOut ? shift.checkOut.toLocaleTimeString() : 'En curso'}
                                            </div>
                                        </div>
                                        <Badge variant={shift.status === 'COMPLETED' ? 'outline' : 'secondary'}>{shift.status}</Badge>
                                    </div>
                                ))}
                                {employee.shifts.length === 0 && <div className="text-slate-500 dark:text-slate-400">Sin historial reciente.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
