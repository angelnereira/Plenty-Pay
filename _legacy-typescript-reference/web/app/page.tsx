import type { Metadata } from "next"
import {
  LandingNavbar,
  HeroSection,
  FeaturesSection,
  FAQSection,
  LandingFooter
} from "@/components/landing"

export const metadata: Metadata = {
  title: "PlentyPay | ERP modular para PyMEs",
  description:
    "Plataforma empresarial modular: facturación fiscal, inventario, punto de venta, logística y control de personal. Activa solo los módulos que necesitas.",
  keywords: [
    "ERP Panamá",
    "plataforma empresarial",
    "facturación electrónica",
    "sistema de inventario",
    "punto de venta",
    "logística entregas",
    "control de personal",
    "software para PyMEs",
  ],
  openGraph: {
    title: "PlentyPay | ERP modular para PyMEs",
    description:
      "Una plataforma para toda tu operación: facturación, inventario, POS, logística y personal. Modular y lista para crecer contigo.",
    type: "website",
    locale: "es_PA",
    siteName: "PlentyPay",
    images: ["/og-image.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlentyPay | ERP modular para PyMEs",
    description:
      "Facturación, inventario, POS, logística y personal en una sola plataforma. Activa módulos cuando los necesites.",
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: "https://plentypay.com",
    languages: {
      "es-PA": "https://plentypay.com",
    },
  },
}

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "PlentyPay",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web, Android, iOS",
    "offers": {
      "@type": "Offer",
      "price": "49.99",
      "priceCurrency": "USD",
      "priceValidUntil": "2026-12-31",
      "availability": "https://schema.org/InStock",
    },
    "description":
      "Plataforma ERP modular para PyMEs: facturación fiscal, inventario, punto de venta, logística, control de personal y reportes.",
    "featureList":
      "Facturación, Inventario, Punto de Venta, Logística, Control de Personal, Reportes",
  }

  return (
    <main className="bg-background text-foreground min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <FAQSection />
      <LandingFooter />
    </main>
  )
}
