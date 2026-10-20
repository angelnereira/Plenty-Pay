BEGIN;
DROP TABLE IF EXISTS idempotency_keys, processed_events, outbox, stock_tasks, receipt_counters, sales,
  cash_movements, cash_sessions;
COMMIT;
