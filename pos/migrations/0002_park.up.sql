-- F17.4: ventas estacionadas (S-POS-06). Aditivo: el binario anterior ignora estas columnas.
BEGIN;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS park_label text NOT NULL DEFAULT '';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS parked_at timestamptz;
COMMIT;
