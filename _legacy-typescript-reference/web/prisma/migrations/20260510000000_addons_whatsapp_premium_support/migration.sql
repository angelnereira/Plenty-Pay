-- Addons recurring nuevos: WhatsApp Business y Soporte Premium
-- ============================================
-- Dos flags booleanos en clients. Default false: ningún tenant los tiene
-- hasta que SUPER_ADMIN los active manualmente o el cliente los compre.
--
-- Onboarding pagado y Hardware (impresoras/lectores) NO viven en este
-- catálogo — se cobran fuera del modelo recurring (gestión manual por
-- SUPER_ADMIN). Solo se exponen como CTA "Solicitar cotización" en la UI.

ALTER TABLE "clients"
    ADD COLUMN IF NOT EXISTS "whatsappEnabled"        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "premiumSupportEnabled"  BOOLEAN NOT NULL DEFAULT false;
