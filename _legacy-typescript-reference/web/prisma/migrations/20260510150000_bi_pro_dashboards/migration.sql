-- BI Pro Fase 2 — dashboards personalizados (BIDashboard + BIWidget)

CREATE TABLE IF NOT EXISTS "bi_dashboards" (
    "id"         TEXT          NOT NULL,
    "clientId"   TEXT          NOT NULL,
    "name"       TEXT          NOT NULL,
    "layout"     JSONB         NOT NULL,
    "isDefault"  BOOLEAN       NOT NULL DEFAULT false,
    "createdBy"  TEXT          NOT NULL,
    "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "bi_dashboards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_dashboards_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bi_dashboards_clientId_idx" ON "bi_dashboards"("clientId");


CREATE TABLE IF NOT EXISTS "bi_widgets" (
    "id"          TEXT          NOT NULL,
    "dashboardId" TEXT          NOT NULL,
    "type"        TEXT          NOT NULL,
    "title"       TEXT          NOT NULL,
    "query"       JSONB         NOT NULL,
    "options"     JSONB,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "bi_widgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bi_widgets_dashboardId_fkey"
        FOREIGN KEY ("dashboardId") REFERENCES "bi_dashboards"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bi_widgets_dashboardId_idx" ON "bi_widgets"("dashboardId");
