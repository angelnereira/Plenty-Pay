-- AddColumn: category, sku, barcode, umc, cpbsCode, categoryMeta, volWeight, itemHash
-- to delivery_order_items table

ALTER TABLE "delivery_order_items" ADD COLUMN "category" TEXT;
ALTER TABLE "delivery_order_items" ADD COLUMN "sku" TEXT;
ALTER TABLE "delivery_order_items" ADD COLUMN "barcode" TEXT;
ALTER TABLE "delivery_order_items" ADD COLUMN "umc" TEXT;
ALTER TABLE "delivery_order_items" ADD COLUMN "cpbsCode" TEXT;
ALTER TABLE "delivery_order_items" ADD COLUMN "categoryMeta" JSONB;
ALTER TABLE "delivery_order_items" ADD COLUMN "volWeight" DECIMAL(12,2);
ALTER TABLE "delivery_order_items" ADD COLUMN "itemHash" TEXT;
