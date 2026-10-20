BEGIN;
DROP TABLE IF EXISTS processed_events, outbox, saga_tasks, sub_orders, orders, quotes, cart_items;
COMMIT;
