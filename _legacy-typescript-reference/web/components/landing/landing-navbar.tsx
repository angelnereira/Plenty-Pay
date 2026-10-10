"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

const navLinks = [
    { href: "#modulos", label: "Módulos" },
    { href: "#planes", label: "Precios" },
    { href: "#faq", label: "Preguntas frecuentes" },
]

export function LandingNavbar() {
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href.startsWith("#")) {
            e.preventDefault()
            const element = document.querySelector(href)
            if (element) {
                element.scrollIntoView({ behavior: "smooth" })
                setIsMobileMenuOpen(false)
            }
        }
    }

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                isScrolled
                    ? "bg-background/80 backdrop-blur-xl border-b border-border py-3"
                    : "bg-transparent py-5"
            )}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <Image
                            src="/plentypay-logo-light.png"
                            alt="PlentyPay"
                            width={130}
                            height={36}
                            className="h-9 w-auto dark:invert-0 invert"
                            priority
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={(e) => handleNavClick(e, link.href)}
                                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    {/* Desktop CTAs */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            href="/auth/signin"
                            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors px-2"
                        >
                            Iniciar sesión
                        </Link>
                        <ThemeToggle />
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        type="button"
                        className="md:hidden p-2 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? (
                            <X className="h-6 w-6" />
                        ) : (
                            <Menu className="h-6 w-6" />
                        )}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden mt-4 pb-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-2 duration-200 bg-background/95 backdrop-blur-xl px-4 rounded-b-2xl shadow-xl">
                        <div className="flex flex-col gap-4">
                            {navLinks.map((link) => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={(e) => handleNavClick(e, link.href)}
                                    className="text-muted-foreground hover:text-foreground text-base font-medium transition-colors py-2"
                                >
                                    {link.label}
                                </a>
                            ))}
                            <div className="flex flex-col gap-3 pt-4 border-t border-border">
                                <Link
                                    href="/auth/signin"
                                    className="text-center py-2.5 text-muted-foreground hover:text-foreground font-medium transition-colors"
                                >
                                    Iniciar sesión
                                </Link>
                                <div className="flex justify-center">
                                    <ThemeToggle />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
