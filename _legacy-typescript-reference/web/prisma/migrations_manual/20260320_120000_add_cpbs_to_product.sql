-- UP
ALTER TABLE "products" ADD COLUMN "cpbsCode" TEXT;
ALTER TABLE "products" ADD COLUMN "cpbsUnit" TEXT;

-- DOWN
-- ALTER TABLE "products" DROP COLUMN "cpbsCode";
-- ALTER TABLE "products" DROP COLUMN "cpbsUnit";
