"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const faqs = [
    {
        question: "¿Qué incluye PlentyPay y cómo funciona la plataforma modular?",
        answer:
            "PlentyPay es un ERP empresarial con seis módulos nativos: facturación fiscal, inventario, punto de venta, logística, control de personal y reportes. Todos comparten una misma base de datos, así que no necesitas conectores ni sincronizaciones manuales. Activas solo los módulos que usas hoy y añades los demás cuando los necesites.",
    },
    {
        question: "¿Puedo empezar con un módulo y agregar otros después?",
        answer:
            "Sí. Nuestro modelo está diseñado para crecer contigo. Puedes comenzar solo con facturación, y activar inventario, POS, logística o personal en cualquier momento desde tu panel — sin migraciones, sin reinstalaciones y sin tiempos muertos.",
    },
    {
        question: "¿Cómo funciona la prueba gratuita?",
        answer:
            "Tienes 14 días con acceso completo a todos los módulos activos de tu plan. No pedimos tarjeta de crédito para empezar. Al terminar la prueba puedes elegir el plan que mejor se adapte a tu operación o cancelar sin compromiso.",
    },
    {
        question: "¿La facturación cumple con la normativa fiscal de Panamá?",
        answer:
            "Sí. Emitimos facturas electrónicas certificadas que cumplen con la regulación fiscal vigente en Panamá. El proceso es transparente: tú facturas, nosotros nos encargamos de la certificación y el reporte en segundos.",
    },
    {
        question: "¿Mis datos están seguros?",
        answer:
            "Aplicamos cifrado de clase bancaria en tránsito y en reposo, respaldos automáticos diarios y separación estricta entre clientes. Tu información es tuya: puedes exportarla en cualquier momento y la almacenamos en infraestructura certificada.",
    },
    {
        question: "¿Funciona sin internet?",
        answer:
            "Los módulos críticos de operación — como el punto de venta — siguen funcionando sin conexión. Las ventas se guardan localmente y se sincronizan automáticamente cuando vuelve la señal. Ideal para locales con internet intermitente o eventos fuera de sede.",
    },
    {
        question: "¿Ofrecen soporte y capacitación para mi equipo?",
        answer:
            "Sí. Todos los planes incluyen soporte en español y onboarding guiado. Los planes Profesional y Empresarial suman capacitación en vivo para tu equipo, soporte prioritario y un punto de contacto dedicado.",
    },
    {
        question: "¿Cómo migramos desde nuestro sistema actual?",
        answer:
            "Te acompañamos en todo el proceso. Importamos tu catálogo de productos, clientes, inventario inicial y saldos de cuentas por cobrar desde hojas de cálculo o sistemas anteriores. La mayoría de nuestros clientes están operando en menos de una semana.",
    },
]

function FAQItem({
    question,
    answer,
    isOpen,
    onClick,
}: {
    question: string
    answer: string
    isOpen: boolean
    onClick: () => void
}) {
    return (
        <div className="border-b border-border last:border-0">
            <button
                type="button"
                onClick={onClick}
                className="w-full py-5 flex items-center justify-between text-left gap-6"
            >
                <span className="text-base sm:text-lg font-medium text-foreground pr-4">
                    {question}
                </span>
                <ChevronDown
                    className={cn(
                        "h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300",
                        isOpen && "rotate-180"
                    )}
                />
            </button>
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300",
                    isOpen ? "max-h-96 pb-5" : "max-h-0"
                )}
            >
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pr-8">
                    {answer}
                </p>
            </div>
        </div>
    )
}

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    return (
        <section id="faq" className="py-24 px-4 bg-background">
            <div className="max-w-3xl mx-auto">
                {/* Section Header */}
                <div className="text-center mb-14">
                    <p className="text-sm font-medium text-primary mb-3 tracking-wide uppercase">
                        Preguntas frecuentes
                    </p>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
                        Resolvemos las dudas más comunes
                    </h2>
                    <p className="text-base sm:text-lg text-muted-foreground">
                        Si necesitas algo más específico, escríbenos y un humano te responde.
                    </p>
                </div>

                {/* FAQ Accordion */}
                <div className="bg-card border border-border rounded-2xl px-6 sm:px-8 divide-y divide-border">
                    {faqs.map((faq, index) => (
                        <FAQItem
                            key={faq.question}
                            question={faq.question}
                            answer={faq.answer}
                            isOpen={openIndex === index}
                            onClick={() =>
                                setOpenIndex(openIndex === index ? null : index)
                            }
                        />
                    ))}
                </div>

                {/* Contact CTA */}
                <div className="text-center mt-10">
                    <p className="text-sm text-muted-foreground mb-2">
                        ¿No encontraste lo que buscabas?
                    </p>
                    <a
                        href="mailto:soporte@plentypay.com"
                        className="inline-flex items-center gap-2 text-primary hover:underline font-medium transition-colors"
                    >
                        Contáctanos directamente
                    </a>
                </div>
            </div>
        </section>
    )
}
