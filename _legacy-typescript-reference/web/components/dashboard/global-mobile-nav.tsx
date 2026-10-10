"use client"

import { BottomNav } from "@/components/dashboard/bottom-nav"

interface GlobalMobileNavProps {
    userRole?: string
    facturacionEnabled?: boolean
    inventoryEnabled?: boolean
    posEnabled?: boolean
    paydayEnabled?: boolean
    logisticsEnabled?: boolean
    creditosEnabled?: boolean
}

export function GlobalMobileNav({ userRole, facturacionEnabled, inventoryEnabled, posEnabled, paydayEnabled, logisticsEnabled, creditosEnabled }: GlobalMobileNavProps) {
    return (
        <BottomNav
            userRole={userRole}
            facturacionEnabled={facturacionEnabled}
            inventoryEnabled={inventoryEnabled}
            posEnabled={posEnabled}
            paydayEnabled={paydayEnabled}
            logisticsEnabled={logisticsEnabled}
            creditosEnabled={creditosEnabled}
        />
    )
}
