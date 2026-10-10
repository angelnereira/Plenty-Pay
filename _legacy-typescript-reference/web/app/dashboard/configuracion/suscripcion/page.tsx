import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubscriptionDetails } from "@/features/subscription/ui/subscription-details";

export const metadata = {
    title: "Mi Suscripción | PlentyPay",
    description: "Gestiona tu plan, módulos y límites de tu suscripción",
};

export default async function SubscriptionPage() {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        redirect("/");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            client: {
                select: {
                    id: true,
                    name: true,
                    planType: true,
                    maxUsers: true,
                    maxPosStations: true,
                    maxBranches: true,
                    extraBranches: true,
                    facturacionEnabled: true,
                    inventoryEnabled: true,
                    posEnabled: true,
                    paydayEnabled: true,
                    logisticsEnabled: true,
                    creditosEnabled: true,
                    motorCreditTier: true,
                    apiAccessEnabled: true,
                    whatsappEnabled: true,
                    premiumSupportEnabled: true,
                    createdAt: true,
                    _count: {
                        select: { users: true }
                    }
                }
            }
        }
    });

    if (!user || !user.client) {
        redirect("/dashboard");
    }

    // Cajas POS activas: sesiones con actividad en los últimos 5 min.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activePosSessionsCount = await prisma.posSession.count({
        where: {
            clientId: user.client.id,
            lastActivity: { gte: fiveMinutesAgo },
            status: "ACTIVE"
        }
    });

    // Empleados activos para nómina dinámica ($20 + $5 × empleado).
    const paydayEmployeeCount = await prisma.paydayEmployee.count({
        where: {
            clientId: user.client.id,
            isActive: true,
        }
    });

    // Facturas del mes en curso para el soft-cap (banner + email).
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const currentMonthInvoiceCount = await prisma.invoice.count({
        where: {
            clientId: user.client.id,
            createdAt: { gte: startOfMonth },
        }
    });

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-4xl mx-auto">
                <SubscriptionDetails
                    client={user.client}
                    currentUsers={user.client._count.users}
                    activePosStations={activePosSessionsCount}
                    paydayEmployeeCount={paydayEmployeeCount}
                    currentMonthInvoiceCount={currentMonthInvoiceCount}
                />
            </div>
        </div>
    );
}
