-- BI Pro Fase 3 — Segmentos, Campañas, Forecasts

CREATE TABLE IF NOT EXISTS "bi_segments" (
    "id"           TEXT          NOT NULL,
    "clientId"     TEXT          NOT NULL,
    "name"         TEXT          NOT NULL,
    "entity"       TEXT          NOT NULL DEFAULT 'customer',
    "rules"        JSONB         NOT NULL,
    "cachedCount"  INTEGER       NOT NULL DEFAULT 0,
    "refreshedAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "bi_segments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_segments_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bi_segments_clientId_idx" ON "bi_segments"("clientId");


CREATE TABLE IF NOT EXISTS "bi_campaigns" (
    "id"          TEXT          NOT NULL,
    "clientId"    TEXT          NOT NULL,
    "segmentId"   TEXT          NOT NULL,
    "channel"     TEXT          NOT NULL,
    "message"     TEXT          NOT NULL,
    "status"      TEXT          NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt"      TIMESTAMP(3),
    "recipients"  INTEGER       NOT NULL DEFAULT 0,
    "conversions" INTEGER       NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "bi_campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_campaigns_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bi_campaigns_segmentId_fkey"
        FOREIGN KEY ("segmentId") REFERENCES "bi_segments"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bi_campaigns_clientId_status_idx" ON "bi_campaigns"("clientId", "status");


CREATE TABLE IF NOT EXISTS "bi_forecasts" (
    "id"          TEXT          NOT NULL,
    "clientId"    TEXT          NOT NULL,
    "metric"      TEXT          NOT NULL,
    "granularity" TEXT          NOT NULL DEFAULT 'day',
    "data"        JSONB         NOT NULL,
    "computedAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_forecasts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_forecasts_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bi_forecasts_clientId_metric_granularity_idx"
    ON "bi_forecasts"("clientId", "metric", "granularity");
