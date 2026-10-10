import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Clock } from "lucide-react";
import Link from "next/link";
import NewEmployeeClient from "./new-employee-client";

export default async function NewEmployeePage() {
    const session = await auth();

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

    return <NewEmployeeClient />;
}
