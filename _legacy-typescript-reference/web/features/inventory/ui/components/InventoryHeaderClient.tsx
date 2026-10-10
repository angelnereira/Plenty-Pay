"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InventoryHeaderActions } from "./InventoryHeaderActions";
import { QuickStockAdditionModal } from "./QuickStockAdditionModal";

export function InventoryHeaderClient() {
    const router = useRouter();
    const [showQuickAdd, setShowQuickAdd] = useState(false);

    const handleSuccess = () => {
        // Refresh the page data after successful stock addition
        router.refresh();
    };

    return (
        <>
            <InventoryHeaderActions onQuickAdd={() => setShowQuickAdd(true)} />
            <QuickStockAdditionModal
                isOpen={showQuickAdd}
                onClose={() => setShowQuickAdd(false)}
                onSuccess={handleSuccess}
            />
        </>
    );
}
