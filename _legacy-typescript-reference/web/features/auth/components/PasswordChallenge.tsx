"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@shared/ui/alert-dialog";
import { Input } from "@shared/ui/input";
import { useState } from "react";
import { useToast } from "@shared/hooks/use-toast";
import { verifyPasswordAction } from "@/app/actions/auth/verify-password.action"; // Need to create this

interface PasswordChallengeProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function PasswordChallenge({ open, onOpenChange, onSuccess }: PasswordChallengeProps) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleVerify = async () => {
        setLoading(true);
        try {
            const result = await verifyPasswordAction(password);

            if (result.success) {
                toast({
                    title: "Acceso Concedido",
                    description: "Modo edición activado.",
                });
                onSuccess();
                onOpenChange(false);
                setPassword("");
            } else {
                toast({
                    variant: "destructive",
                    title: "Contraseña Incorrecta",
                    description: "Inténtalo de nuevo.",
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Ocurrió un error al verificar.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Seguridad Requerida</AlertDialogTitle>
                    <AlertDialogDescription>
                        Ingresa tu contraseña para habilitar el modo de edición.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4">
                    <Input
                        type="password"
                        placeholder="Contraseña actual"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                    />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => { e.preventDefault(); handleVerify(); }} disabled={loading}>
                        {loading ? "Verificando..." : "Confirmar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
