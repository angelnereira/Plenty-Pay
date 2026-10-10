"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface SidebarContextType {
    isCollapsed: boolean
    toggleSidebar: () => void
    setCollapsed: (value: boolean) => void
    isMobileOpen: boolean
    toggleMobileSidebar: () => void
    setMobileOpen: (value: boolean) => void
    isHovered: boolean
    setHovered: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    // Estado persistente para desktop — persiste en localStorage
    // Initialize to false to match server render, then sync from localStorage after hydration
    const [isCollapsed, setIsCollapsed] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem("plentypay-sidebar-collapsed")
        if (stored !== null) {
            setIsCollapsed(stored === "true")
        }
    }, [])
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [isHovered, setIsHovered] = useState(false)

    // Cerrar móvil al cambiar tamaño a desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsMobileOpen(false)
            }
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    const toggleSidebar = () => {
        const next = !isCollapsed
        setIsCollapsed(next)
        localStorage.setItem("plentypay-sidebar-collapsed", String(next))
    }
    const setCollapsedPersist = (value: boolean) => {
        setIsCollapsed(value)
        localStorage.setItem("plentypay-sidebar-collapsed", String(value))
    }
    const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen)

    return (
        <SidebarContext.Provider
            value={{
                isCollapsed,
                toggleSidebar,
                setCollapsed: setCollapsedPersist,
                isMobileOpen,
                toggleMobileSidebar,
                setMobileOpen: setIsMobileOpen,
                isHovered,
                setHovered: setIsHovered,
            }}
        >
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (context === undefined) {
        throw new Error("useSidebar must be used within a SidebarProvider")
    }
    return context
}
