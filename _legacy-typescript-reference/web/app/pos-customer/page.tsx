import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { CustomerView } from "@/features/pos/ui/CustomerView";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Vista Cliente - PlentyPay",
    description: "Pantalla secundaria para clientes",
};

export default async function PosCustomerPage() {
    const session = await auth();

    if (!session || !session.user) {
        redirect("/");
    }

    return <CustomerView />;
}
