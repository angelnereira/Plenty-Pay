-- Módulo de Créditos: gestión de créditos otorgados por el tenant a sus clientes.
-- Default TRUE — el módulo es visible por defecto. La responsabilidad legal recae
-- en el tenant; la plataforma solo distribuye el software. SUPER_ADMIN puede
-- desactivarlo por cliente si fuera necesario.

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "creditos_enabled" BOOLEAN NOT NULL DEFAULT true;
