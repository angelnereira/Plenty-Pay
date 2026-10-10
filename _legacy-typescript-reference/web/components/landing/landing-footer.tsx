"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const footerLinks = {
    producto: [
        { label: "Módulos", href: "#modulos" },
        { label: "Precios", href: "#planes" },
        { label: "Preguntas frecuentes", href: "#faq" },
    ],
    empresa: [
        { label: "Sobre nosotros", href: "#" },
        { label: "Contacto", href: "mailto:soporte@plentypay.com" },
        { label: "Blog", href: "#" },
    ],
    legal: [
        { label: "Términos y condiciones", href: "/terms" },
        { label: "Política de privacidad", href: "/privacy" },
    ],
}

export function LandingFooter() {
    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        if (href.startsWith("#")) {
            e.preventDefault()
            const element = document.querySelector(href)
            if (element) {
                element.scrollIntoView({ behavior: "smooth" })
            }
        }
    }

    return (
        <footer className="bg-slate-950 border-t border-white/10">
            {/* CTA Section */}
            <div className="max-w-7xl mx-auto px-4 py-20">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600/15 to-slate-900 border border-white/10 p-10 md:p-16">
                    <div
                        className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-[150px]"
                        aria-hidden
                    />
                    <div className="relative z-10 text-center max-w-2xl mx-auto">
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
                            Moderniza tu operación hoy
                        </h2>
                        <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
                            Activa los módulos que necesitas, conecta a tu equipo y empieza
                            a operar desde cualquier dispositivo.
                        </p>
                        <Link
                            href="/auth/signup"
                            className={cn(
                                "inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-base font-semibold transition-all duration-200",
                                "bg-white text-slate-900 hover:bg-slate-100"
                            )}
                        >
                            Crear cuenta
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Footer */}
            <div className="max-w-7xl mx-auto px-4 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 pb-12 border-b border-white/10">
                    {/* Brand Column */}
                    <div className="lg:col-span-2">
                        <Image
                            src="/plentypay-logo-light.png"
                            alt="PlentyPay"
                            width={130}
                            height={36}
                            className="h-9 w-auto mb-6"
                        />
                        <p className="text-slate-400 mb-6 max-w-sm leading-relaxed text-sm">
                            Plataforma ERP modular. Facturación fiscal, inventario,
                            punto de venta, logística y control de personal — en una sola
                            plataforma, lista para crecer contigo.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-400 text-xs font-medium uppercase tracking-wide">
                                Sistema operativo
                            </span>
                        </div>
                    </div>

                    {/* Producto Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4 text-sm">Producto</h4>
                        <ul className="space-y-3">
                            {footerLinks.producto.map((link) => (
                                <li key={link.href}>
                                    <a
                                        href={link.href}
                                        onClick={(e) => handleNavClick(e, link.href)}
                                        className="text-slate-400 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Empresa Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4 text-sm">Empresa</h4>
                        <ul className="space-y-3">
                            {footerLinks.empresa.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-slate-400 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h4 className="text-white font-semibold mb-4 text-sm">Legal</h4>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-slate-400 hover:text-white transition-colors text-sm"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8">
                    <p className="text-slate-500 text-sm">
                        © {new Date().getFullYear()} PlentyPay. Todos los derechos reservados.
                    </p>
                    <div className="flex items-center gap-6">
                        <span className="text-slate-500 text-xs hidden md:inline">
                            Facturación certificada para Panamá · Datos cifrados
                        </span>
                        <a
                            href="mailto:soporte@plentypay.com"
                            className="text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            soporte@plentypay.com
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
