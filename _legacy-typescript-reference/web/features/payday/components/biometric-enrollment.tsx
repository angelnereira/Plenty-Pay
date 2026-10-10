'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Fingerprint, Loader2, Trash2, ShieldCheck, Plus } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import {
    generateRegisterOptions,
    verifyRegistration,
    getEmployeeAuthenticators,
    deleteAuthenticator
} from '@/features/payday/actions/webauthn';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/shared/ui/table';
import { useSession } from 'next-auth/react';

interface BiometricEnrollmentProps {
    employeeId: string;
    firstName: string;
    clientId: string;
}

interface AuthenticatorInfo {
    id: string;
    createdAt: Date;
    credentialDeviceType: string;
    transports: string | null;
}

export function BiometricEnrollment({ employeeId, firstName, clientId }: BiometricEnrollmentProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [authenticators, setAuthenticators] = useState<AuthenticatorInfo[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    const loadAuthenticators = async () => {
        try {
            const data = await getEmployeeAuthenticators(employeeId, clientId);
            setAuthenticators(data);
        } catch (error) {
            console.error('Failed to load authenticators', error);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        loadAuthenticators();
    }, [employeeId]);

    const handleRegister = async () => {
        setIsLoading(true);
        try {
            // 1. Get options from server
            const options = await generateRegisterOptions(employeeId, clientId);

            // 2. Browser handles biometric prompt
            // Note: Types for simplewebauthn might mismatch slightly due to rapid version changes, 
            // usually casting or direct usage works if versions align.
            const attResp = await startRegistration(options);

            // 3. Verify with server
            await verifyRegistration(employeeId, clientId, attResp);

            toast.success('Huella digital registrada exitosamente');
            loadAuthenticators();
        } catch (error: any) {
            console.error(error);
            if (error.name === 'NotAllowedError') {
                toast.error('Operación cancelada por el usuario');
            } else {
                toast.error('Error al registrar biometría: ' + (error.message || 'Desconocido'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (authId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta credencial?')) return;

        try {
            await deleteAuthenticator(authId, clientId);
            toast.success('Credencial eliminada');
            loadAuthenticators();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Fingerprint className="h-5 w-5 text-primary" />
                        Acceso Biométrico (Kiosko)
                    </CardTitle>
                    <CardDescription>
                        Gestiona las huellas digitales o FaceID para el registro de asistencia en kioskos.
                    </CardDescription>
                </div>
                <Button
                    onClick={handleRegister}
                    disabled={isLoading}
                    className="gap-2"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Registrar Huella
                </Button>
            </CardHeader>
            <CardContent>
                {isFetching ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : authenticators.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg bg-muted/50">
                        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No hay credenciales registradas para {firstName}.</p>
                        <p className="text-xs mt-1">Registra una huella para permitir el acceso en el kiosko.</p>
                    </div>
                ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Fecha Registro</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {authenticators.map((auth) => (
                                    <TableRow key={auth.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    {auth.credentialDeviceType === 'singleDevice' ? 'Dispositivo Físico' : 'Passkey (Sync)'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(auth.createdAt).toLocaleDateString()} {new Date(auth.createdAt).toLocaleTimeString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(auth.id)}
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
