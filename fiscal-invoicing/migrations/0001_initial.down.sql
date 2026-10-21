-- PlentyPay - fiscal-invoicing: revertir 0001 (solo desarrollo: N-FIS-15 exige conservar los documentos).
BEGIN;
DROP TABLE IF EXISTS outbox, taxpayers, invoices, folio_ranges, profiles;
DROP FUNCTION IF EXISTS invoices_guard();
COMMIT;
