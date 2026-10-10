-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "CheckoutPreference" AS ENUM ('ALWAYS_DGI', 'INTERNAL_ONLY', 'ASK_ALWAYS', 'AUTO_THRESHOLD');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'INTERNAL', 'QUEUED', 'PROCESSING', 'EMITTED', 'CERTIFIED', 'REJECTED', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'FACTURA_EXPORTACION');

-- CreateEnum
CREATE TYPE "ReceiverType" AS ENUM ('CONTRIBUTOR', 'FINAL_CONSUMER', 'FOREIGN');

-- CreateEnum
CREATE TYPE "HKAEnvironment" AS ENUM ('DEMO', 'PROD');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATED', 'UPDATED', 'QUEUED', 'SENT', 'PROCESSING', 'CERTIFIED', 'REJECTED', 'ERROR', 'CANCELLED', 'DOWNLOADED_XML', 'DOWNLOADED_PDF', 'EMAIL_SENT', 'RETRIED', 'MANUAL_INTERVENTION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVOICE_CERTIFIED', 'INVOICE_REJECTED', 'INVOICE_ERROR', 'FOLIOS_LOW', 'FOLIOS_DEPLETED', 'FOLIOS_ASSIGNED', 'SYSTEM_ALERT', 'PAYMENT_REQUIRED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('ENTRY', 'EXIT', 'ADJUST');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "SupplierTier" AS ENUM ('STRATEGIC', 'PREFERRED', 'STANDARD', 'PROBATION');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PaydayContractType" AS ENUM ('DEFINIDO', 'INDEFINIDO', 'OBRA_DETERMINADA');

-- CreateEnum
CREATE TYPE "PaydayPaymentMode" AS ENUM ('TIEMPO', 'TAREA');

-- CreateEnum
CREATE TYPE "PaydayEntryMethod" AS ENUM ('FACE_RECOGNITION', 'FINGERPRINT', 'NFC', 'QR_DYNAMIC', 'PIN_CODE', 'MANUAL_ADMIN');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'COMPLETED', 'REVIEW_NEEDED', 'APPROVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'LOCKED', 'PAID');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruc" TEXT,
    "dv" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "hkaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "hkaTokenUser" TEXT,
    "hkaTokenPassword" TEXT,
    "hkaEnvironment" TEXT DEFAULT 'demo',
    "rucType" TEXT NOT NULL DEFAULT '2',
    "tradeName" TEXT,
    "commercialName" TEXT,
    "branchCode" TEXT NOT NULL DEFAULT '0000',
    "locationCode" TEXT NOT NULL DEFAULT '1-1-1',
    "province" TEXT NOT NULL DEFAULT 'PANAMA',
    "district" TEXT NOT NULL DEFAULT 'PANAMA',
    "corregimiento" TEXT NOT NULL DEFAULT 'SAN FELIPE',
    "autoSendToHKA" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "emailOnCertification" BOOLEAN NOT NULL DEFAULT true,
    "emailOnError" BOOLEAN NOT NULL DEFAULT true,
    "lowFoliosThreshold" INTEGER NOT NULL DEFAULT 10,
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "maxPosStations" INTEGER NOT NULL DEFAULT 1,
    "maxFolios" INTEGER,
    "lastInvoiceNumber" INTEGER NOT NULL DEFAULT 999999,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "inventoryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "posEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paydayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inventoryValuationMethod" TEXT NOT NULL DEFAULT 'WEIGHTED_AVG',
    "defaultLeadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "lowStockAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoReorderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "demoStartDate" TIMESTAMP(3),
    "demoEndDate" TIMESTAMP(3),
    "pendingModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planType" TEXT NOT NULL DEFAULT 'CRECIMIENTO',
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "image" TEXT,
    "ruc" TEXT,
    "dv" TEXT,
    "clientId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Panama',
    "checkoutPreference" "CheckoutPreference" NOT NULL DEFAULT 'ALWAYS_DGI',
    "checkoutThreshold" DECIMAL(10,2) NOT NULL DEFAULT 20.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stationName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "deviceInfo" TEXT,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hka_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "environment" "HKAEnvironment" NOT NULL DEFAULT 'DEMO',
    "tokenUser" TEXT NOT NULL,
    "tokenPassword" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hka_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_pools" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'HKA',
    "totalFolios" INTEGER NOT NULL,
    "availableFolios" INTEGER NOT NULL,
    "assignedFolios" INTEGER NOT NULL DEFAULT 0,
    "consumedFolios" INTEGER NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchaseAmount" DECIMAL(12,2) NOT NULL,
    "hkaInvoiceNumber" TEXT,
    "folioStart" TEXT,
    "folioEnd" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folio_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_assignments" (
    "id" TEXT NOT NULL,
    "folioPoolId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedAmount" INTEGER NOT NULL,
    "consumedAmount" INTEGER NOT NULL DEFAULT 0,
    "alertThreshold" INTEGER NOT NULL DEFAULT 10,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "lastAlertAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "assignedBy" TEXT,

    CONSTRAINT "folio_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_consumptions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "folioNumber" TEXT,

    CONSTRAINT "folio_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "clientReferenceId" TEXT NOT NULL,
    "customerId" TEXT,
    "issuerRuc" TEXT NOT NULL,
    "issuerDv" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "issuerAddress" TEXT NOT NULL,
    "issuerEmail" TEXT NOT NULL,
    "issuerPhone" TEXT,
    "receiverType" "ReceiverType" NOT NULL DEFAULT 'CONTRIBUTOR',
    "receiverRuc" TEXT,
    "receiverDv" TEXT,
    "receiverName" TEXT NOT NULL,
    "receiverEmail" TEXT,
    "receiverPhone" TEXT,
    "receiverAddress" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'FACTURA',
    "invoiceNumber" TEXT,
    "cufe" TEXT,
    "cafe" TEXT,
    "numeroDocumentoFiscal" TEXT,
    "qrCode" TEXT,
    "qrUrl" TEXT,
    "pointOfSale" TEXT NOT NULL DEFAULT '001',
    "securityCode" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "paymentTerm" TEXT NOT NULL DEFAULT 'CASH',
    "xmlContent" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalAfterDiscount" DECIMAL(12,2) NOT NULL,
    "itbms" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PAB',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "hkaStatus" TEXT,
    "hkaMessage" TEXT,
    "rejectionReason" TEXT,
    "hkaCode" TEXT,
    "hkaProtocol" TEXT,
    "protocoloSeguridad" TEXT,
    "hkaProtocolDate" TIMESTAMP(3),
    "pdfBase64" TEXT,
    "hkaResponseCode" TEXT,
    "hkaResponseMessage" TEXT,
    "hkaResponseData" JSONB,
    "hkaLastAttempt" TIMESTAMP(3),
    "hkaAttempts" INTEGER NOT NULL DEFAULT 0,
    "emittedAt" TIMESTAMP(3),
    "pdfDescargado" BOOLEAN NOT NULL DEFAULT false,
    "xmlDescargado" BOOLEAN NOT NULL DEFAULT false,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "rawXml" TEXT,
    "currentPhase" INTEGER DEFAULT 0,
    "phaseHistory" JSONB,
    "phaseErrors" JSONB,
    "lastPhaseAttempt" TIMESTAMP(3),
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancellationCufe" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "dv" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "locationCode" TEXT,
    "province" TEXT,
    "district" TEXT,
    "corregimiento" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'PA',
    "clientType" TEXT NOT NULL DEFAULT '01',
    "rucType" TEXT NOT NULL DEFAULT '2',
    "codigoCPBS" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UND',
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountedPrice" DECIMAL(12,2),
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "taxCode" TEXT NOT NULL DEFAULT '01',
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "otiCode" TEXT,
    "otiAmount" DECIMAL(12,2),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "cpbsCode" TEXT,
    "cpbsUnit" TEXT,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_logs" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "userEmail" TEXT,
    "userIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "hkaTrackingId" TEXT,
    "status" "EmailStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "includePDF" BOOLEAN NOT NULL DEFAULT true,
    "includeXML" BOOLEAN NOT NULL DEFAULT true,
    "customMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 100,
    "rateLimitWindow" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_logs" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "requestHeaders" JSONB,
    "requestBody" TEXT,
    "requestQuery" JSONB,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT,
    "responseHeaders" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER,
    "responseSize" INTEGER,
    "apiName" TEXT,
    "apiMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "method" TEXT,
    "path" TEXT,
    "endpoint" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "clientId" TEXT,
    "errorType" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorStack" TEXT,
    "requestBody" TEXT,
    "requestQuery" JSONB,
    "requestHeaders" JSONB,
    "responseBody" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "duration" INTEGER,
    "environment" TEXT,
    "hostname" TEXT,
    "version" TEXT,
    "sentryEventId" TEXT,
    "sentryUrl" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "collectionId" TEXT,
    "schedule" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "regions" JSONB,
    "notifications" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_runs" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "region" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "triggeredBy" TEXT,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "passedTests" INTEGER NOT NULL DEFAULT 0,
    "failedTests" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_run_requests" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "requestName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseTime" INTEGER,
    "responseSize" INTEGER,
    "passedTests" INTEGER NOT NULL DEFAULT 0,
    "failedTests" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "errorCode" TEXT,
    "requestBody" TEXT,
    "responseBody" TEXT,
    "requestHeaders" JSONB,
    "responseHeaders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_run_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitor_run_tests" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_run_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variables" JSONB,
    "scope" TEXT NOT NULL DEFAULT 'collection',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hka_locations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,
    "corregimiento" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hka_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hka_countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEs" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hka_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hka_cpbs_categories" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "segmentName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hka_cpbs_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "category" TEXT,
    "image" TEXT,
    "weight" TEXT,
    "size" TEXT,
    "dimensions" TEXT,
    "color" TEXT,
    "material" TEXT,
    "unitType" TEXT NOT NULL DEFAULT 'UND',
    "currentStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "taxCode" TEXT NOT NULL DEFAULT '01',
    "originCountry" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "abcClass" TEXT NOT NULL DEFAULT 'C',
    "abcClassifiedAt" TIMESTAMP(3),
    "reorderPoint" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "safetyStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "eoqQuantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "avgDailyDemand" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "demandVariability" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastDemandUpdate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "initialQuantity" DECIMAL(12,4) NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT,
    "originCountry" TEXT,
    "goodsReceiptItemId" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "invoiceId" TEXT,
    "lotId" TEXT,
    "reason" TEXT,
    "reference" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "ruc" TEXT,
    "dv" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PA',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "website" TEXT,
    "paymentTerms" TEXT,
    "creditLimit" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bankAccount" TEXT,
    "bankName" TEXT,
    "defaultLeadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "category" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minOrderQty" DECIMAL(12,4),
    "leadTimeDays" INTEGER,
    "supplierSku" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "onTimeDeliveryRate" DECIMAL(5,2) NOT NULL,
    "qualityRate" DECIMAL(5,2) NOT NULL,
    "responseTimeScore" DECIMAL(5,2) NOT NULL,
    "priceCompetitiveness" DECIMAL(5,2) NOT NULL,
    "overallScore" DECIMAL(5,2) NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "onTimeOrders" INTEGER NOT NULL DEFAULT 0,
    "lateOrders" INTEGER NOT NULL DEFAULT 0,
    "defectiveItems" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "evaluatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "department" TEXT,
    "costCenter" TEXT,
    "budgetCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "estimatedTotal" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_items" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UND',
    "estimatedUnitPrice" DECIMAL(12,2) NOT NULL,
    "estimatedTotal" DECIMAL(12,2) NOT NULL,
    "suggestedSupplierId" TEXT,
    "notes" TEXT,

    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "requisitionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "confirmedDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "cancelledDate" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "shippingAddress" TEXT,
    "shippingMethod" TEXT,
    "shippingCost" DECIMAL(12,2),
    "paymentTerms" TEXT,
    "paymentMethod" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UND',
    "quantityOrdered" DECIMAL(12,4) NOT NULL,
    "quantityReceived" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "quantityPending" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedBy" TEXT NOT NULL,
    "deliveryNote" TEXT,
    "invoiceNumber" TEXT,
    "inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "inspectedBy" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "inspectionNotes" TEXT,
    "warehouseLocation" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "poItemId" TEXT,
    "productId" TEXT,
    "quantityReceived" DECIMAL(12,4) NOT NULL,
    "quantityAccepted" DECIMAL(12,4) NOT NULL,
    "quantityRejected" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "qualityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_broadcasts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "targetAll" BOOLEAN NOT NULL DEFAULT true,
    "targetPlans" TEXT[],
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetPlans" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "metadata" JSONB,
    "browserInfo" TEXT,
    "urlPath" TEXT,
    "errorLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payday_configs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "commercialZone" TEXT NOT NULL DEFAULT 'NORMAL',
    "operationalHours" JSONB,
    "payFrequency" "PayFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "nextPayDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payday_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payday_employees" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "contractType" "PaydayContractType" NOT NULL DEFAULT 'INDEFINIDO',
    "paymentMode" "PaydayPaymentMode" NOT NULL DEFAULT 'TIEMPO',
    "baseSalary" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(10,2),
    "faceIdHash" TEXT,
    "faceDescriptor" JSONB,
    "fingerprintId" TEXT,
    "nfcTagId" TEXT,
    "qrSecret" TEXT,
    "pinCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminatedAt" TIMESTAMP(3),
    "workGroupId" TEXT,

    CONSTRAINT "payday_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticators" (
    "id" TEXT NOT NULL,
    "credentialID" BYTEA NOT NULL,
    "credentialPublicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "employeeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authenticators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3),
    "breakStart" TIMESTAMP(3),
    "breakEnd" TIMESTAMP(3),
    "entryMethod" "PaydayEntryMethod" NOT NULL,
    "exitMethod" "PaydayEntryMethod",
    "geoLocation" JSONB,
    "userAgent" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "workShiftId" TEXT,
    "scheduledCheckIn" TIMESTAMP(3),
    "scheduledCheckOut" TIMESTAMP(3),
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyDepartureMinutes" INTEGER NOT NULL DEFAULT 0,
    "rawDurationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime25" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime75" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "correctedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payday_work_shifts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakDuration" INTEGER NOT NULL DEFAULT 60,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payday_work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payday_work_groups" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payday_work_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payday_schedule_assignments" (
    "id" TEXT NOT NULL,
    "workGroupId" TEXT,
    "employeeId" TEXT,
    "workShiftId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "daysOfWeek" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payday_schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "task_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payday_payroll_runs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalGross" DECIMAL(12,2) NOT NULL,
    "totalNet" DECIMAL(12,2) NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "payday_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "regularPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtimePay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonuses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_requests" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentPlan" TEXT NOT NULL,
    "requestedPlan" TEXT,
    "requestedModules" TEXT[],
    "extraUsers" INTEGER NOT NULL DEFAULT 0,
    "extraPosStations" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,

    CONSTRAINT "upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosk_sessions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "employeeId" TEXT,
    "action" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kiosk_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_reservations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "previousStock" DECIMAL(12,4) NOT NULL,
    "newStock" DECIMAL(12,4) NOT NULL,
    "productVersion" INTEGER NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_offline_transactions" (
    "id" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "createdAtLocal" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),
    "items" JSONB NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictReason" TEXT,
    "conflictResolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionAction" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_offline_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_slug_key" ON "clients"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "clients_ruc_key" ON "clients"("ruc");

-- CreateIndex
CREATE INDEX "clients_slug_idx" ON "clients"("slug");

-- CreateIndex
CREATE INDEX "clients_ruc_idx" ON "clients"("ruc");

-- CreateIndex
CREATE INDEX "clients_isActive_idx" ON "clients"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_clientId_idx" ON "users"("clientId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "pos_sessions_clientId_status_idx" ON "pos_sessions"("clientId", "status");

-- CreateIndex
CREATE INDEX "pos_sessions_userId_idx" ON "pos_sessions"("userId");

-- CreateIndex
CREATE INDEX "pos_sessions_lastActivity_idx" ON "pos_sessions"("lastActivity");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "hka_credentials_userId_environment_idx" ON "hka_credentials"("userId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "hka_credentials_userId_environment_key" ON "hka_credentials"("userId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "folio_pools_batchNumber_key" ON "folio_pools"("batchNumber");

-- CreateIndex
CREATE INDEX "folio_pools_isActive_idx" ON "folio_pools"("isActive");

-- CreateIndex
CREATE INDEX "folio_pools_batchNumber_idx" ON "folio_pools"("batchNumber");

-- CreateIndex
CREATE INDEX "folio_pools_expiresAt_idx" ON "folio_pools"("expiresAt");

-- CreateIndex
CREATE INDEX "folio_assignments_clientId_idx" ON "folio_assignments"("clientId");

-- CreateIndex
CREATE INDEX "folio_assignments_folioPoolId_idx" ON "folio_assignments"("folioPoolId");

-- CreateIndex
CREATE UNIQUE INDEX "folio_assignments_folioPoolId_clientId_key" ON "folio_assignments"("folioPoolId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "folio_consumptions_invoiceId_key" ON "folio_consumptions"("invoiceId");

-- CreateIndex
CREATE INDEX "folio_consumptions_assignmentId_idx" ON "folio_consumptions"("assignmentId");

-- CreateIndex
CREATE INDEX "folio_consumptions_invoiceId_idx" ON "folio_consumptions"("invoiceId");

-- CreateIndex
CREATE INDEX "folio_consumptions_consumedAt_idx" ON "folio_consumptions"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_clientReferenceId_key" ON "invoices"("clientReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_cufe_key" ON "invoices"("cufe");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_hkaProtocol_key" ON "invoices"("hkaProtocol");

-- CreateIndex
CREATE INDEX "invoices_clientId_idx" ON "invoices"("clientId");

-- CreateIndex
CREATE INDEX "invoices_createdBy_idx" ON "invoices"("createdBy");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_cufe_idx" ON "invoices"("cufe");

-- CreateIndex
CREATE INDEX "invoices_cafe_idx" ON "invoices"("cafe");

-- CreateIndex
CREATE INDEX "invoices_issuerRuc_idx" ON "invoices"("issuerRuc");

-- CreateIndex
CREATE INDEX "invoices_receiverRuc_idx" ON "invoices"("receiverRuc");

-- CreateIndex
CREATE INDEX "invoices_createdAt_idx" ON "invoices"("createdAt");

-- CreateIndex
CREATE INDEX "invoices_issueDate_idx" ON "invoices"("issueDate");

-- CreateIndex
CREATE INDEX "invoices_documentType_idx" ON "invoices"("documentType");

-- CreateIndex
CREATE INDEX "invoices_currentPhase_idx" ON "invoices"("currentPhase");

-- CreateIndex
CREATE INDEX "invoices_lastPhaseAttempt_idx" ON "invoices"("lastPhaseAttempt");

-- CreateIndex
CREATE INDEX "invoices_clientId_status_idx" ON "invoices"("clientId", "status");

-- CreateIndex
CREATE INDEX "invoices_clientId_createdAt_idx" ON "invoices"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "invoices_clientId_status_createdAt_idx" ON "invoices"("clientId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "customers_clientId_idx" ON "customers"("clientId");

-- CreateIndex
CREATE INDEX "customers_clientId_isActive_idx" ON "customers"("clientId", "isActive");

-- CreateIndex
CREATE INDEX "customers_ruc_idx" ON "customers"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "customers_clientId_ruc_dv_key" ON "customers"("clientId", "ruc", "dv");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_lineNumber_idx" ON "invoice_items"("invoiceId", "lineNumber");

-- CreateIndex
CREATE INDEX "invoice_logs_invoiceId_idx" ON "invoice_logs"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_logs_createdAt_idx" ON "invoice_logs"("createdAt");

-- CreateIndex
CREATE INDEX "invoice_logs_action_idx" ON "invoice_logs"("action");

-- CreateIndex
CREATE INDEX "email_deliveries_invoiceId_idx" ON "email_deliveries"("invoiceId");

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");

-- CreateIndex
CREATE INDEX "email_deliveries_hkaTrackingId_idx" ON "email_deliveries"("hkaTrackingId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_clientId_idx" ON "api_keys"("clientId");

-- CreateIndex
CREATE INDEX "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "system_configs_key_idx" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_clientId_idx" ON "system_configs"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_clientId_key_key" ON "system_configs"("clientId", "key");

-- CreateIndex
CREATE INDEX "api_logs_userId_idx" ON "api_logs"("userId");

-- CreateIndex
CREATE INDEX "api_logs_clientId_idx" ON "api_logs"("clientId");

-- CreateIndex
CREATE INDEX "api_logs_endpoint_idx" ON "api_logs"("endpoint");

-- CreateIndex
CREATE INDEX "api_logs_statusCode_idx" ON "api_logs"("statusCode");

-- CreateIndex
CREATE INDEX "api_logs_success_idx" ON "api_logs"("success");

-- CreateIndex
CREATE INDEX "api_logs_apiName_idx" ON "api_logs"("apiName");

-- CreateIndex
CREATE INDEX "api_logs_createdAt_idx" ON "api_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "error_logs_sentryEventId_key" ON "error_logs"("sentryEventId");

-- CreateIndex
CREATE INDEX "error_logs_userId_idx" ON "error_logs"("userId");

-- CreateIndex
CREATE INDEX "error_logs_clientId_idx" ON "error_logs"("clientId");

-- CreateIndex
CREATE INDEX "error_logs_endpoint_idx" ON "error_logs"("endpoint");

-- CreateIndex
CREATE INDEX "error_logs_errorType_idx" ON "error_logs"("errorType");

-- CreateIndex
CREATE INDEX "error_logs_errorCode_idx" ON "error_logs"("errorCode");

-- CreateIndex
CREATE INDEX "error_logs_resolved_idx" ON "error_logs"("resolved");

-- CreateIndex
CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");

-- CreateIndex
CREATE INDEX "error_logs_requestId_idx" ON "error_logs"("requestId");

-- CreateIndex
CREATE INDEX "error_logs_sentryEventId_idx" ON "error_logs"("sentryEventId");

-- CreateIndex
CREATE INDEX "monitors_createdBy_idx" ON "monitors"("createdBy");

-- CreateIndex
CREATE INDEX "monitors_enabled_idx" ON "monitors"("enabled");

-- CreateIndex
CREATE INDEX "monitor_runs_monitorId_idx" ON "monitor_runs"("monitorId");

-- CreateIndex
CREATE INDEX "monitor_runs_status_idx" ON "monitor_runs"("status");

-- CreateIndex
CREATE INDEX "monitor_runs_startedAt_idx" ON "monitor_runs"("startedAt");

-- CreateIndex
CREATE INDEX "monitor_run_requests_runId_idx" ON "monitor_run_requests"("runId");

-- CreateIndex
CREATE INDEX "monitor_run_tests_requestId_idx" ON "monitor_run_tests"("requestId");

-- CreateIndex
CREATE INDEX "monitor_run_tests_passed_idx" ON "monitor_run_tests"("passed");

-- CreateIndex
CREATE INDEX "collections_createdBy_idx" ON "collections"("createdBy");

-- CreateIndex
CREATE INDEX "environments_createdBy_idx" ON "environments"("createdBy");

-- CreateIndex
CREATE INDEX "environments_scope_idx" ON "environments"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "hka_locations_code_key" ON "hka_locations"("code");

-- CreateIndex
CREATE INDEX "hka_locations_code_idx" ON "hka_locations"("code");

-- CreateIndex
CREATE INDEX "hka_locations_provincia_idx" ON "hka_locations"("provincia");

-- CreateIndex
CREATE INDEX "hka_locations_provincia_distrito_idx" ON "hka_locations"("provincia", "distrito");

-- CreateIndex
CREATE UNIQUE INDEX "hka_countries_code_key" ON "hka_countries"("code");

-- CreateIndex
CREATE INDEX "hka_countries_code_idx" ON "hka_countries"("code");

-- CreateIndex
CREATE INDEX "hka_cpbs_categories_segment_idx" ON "hka_cpbs_categories"("segment");

-- CreateIndex
CREATE INDEX "hka_cpbs_categories_family_idx" ON "hka_cpbs_categories"("family");

-- CreateIndex
CREATE UNIQUE INDEX "hka_cpbs_categories_segment_family_key" ON "hka_cpbs_categories"("segment", "family");

-- CreateIndex
CREATE INDEX "products_clientId_idx" ON "products"("clientId");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_version_idx" ON "products"("version");

-- CreateIndex
CREATE UNIQUE INDEX "products_clientId_sku_key" ON "products"("clientId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_clientId_barcode_key" ON "products"("clientId", "barcode");

-- CreateIndex
CREATE INDEX "inventory_lots_productId_idx" ON "inventory_lots"("productId");

-- CreateIndex
CREATE INDEX "inventory_lots_batchNumber_idx" ON "inventory_lots"("batchNumber");

-- CreateIndex
CREATE INDEX "inventory_lots_expiryDate_idx" ON "inventory_lots"("expiryDate");

-- CreateIndex
CREATE INDEX "inventory_lots_supplierId_idx" ON "inventory_lots"("supplierId");

-- CreateIndex
CREATE INDEX "inventory_transactions_productId_idx" ON "inventory_transactions"("productId");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions"("type");

-- CreateIndex
CREATE INDEX "inventory_transactions_invoiceId_idx" ON "inventory_transactions"("invoiceId");

-- CreateIndex
CREATE INDEX "inventory_transactions_createdAt_idx" ON "inventory_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "suppliers_clientId_idx" ON "suppliers"("clientId");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "suppliers_tier_idx" ON "suppliers"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_clientId_code_key" ON "suppliers"("clientId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_clientId_ruc_dv_key" ON "suppliers"("clientId", "ruc", "dv");

-- CreateIndex
CREATE INDEX "supplier_products_productId_idx" ON "supplier_products"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplierId_productId_key" ON "supplier_products"("supplierId", "productId");

-- CreateIndex
CREATE INDEX "supplier_evaluations_supplierId_idx" ON "supplier_evaluations"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_evaluations_periodEnd_idx" ON "supplier_evaluations"("periodEnd");

-- CreateIndex
CREATE INDEX "purchase_requisitions_clientId_idx" ON "purchase_requisitions"("clientId");

-- CreateIndex
CREATE INDEX "purchase_requisitions_status_idx" ON "purchase_requisitions"("status");

-- CreateIndex
CREATE INDEX "purchase_requisitions_requestedBy_idx" ON "purchase_requisitions"("requestedBy");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_clientId_requisitionNumber_key" ON "purchase_requisitions"("clientId", "requisitionNumber");

-- CreateIndex
CREATE INDEX "purchase_requisition_items_requisitionId_idx" ON "purchase_requisition_items"("requisitionId");

-- CreateIndex
CREATE INDEX "purchase_orders_clientId_idx" ON "purchase_orders"("clientId");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_orderDate_idx" ON "purchase_orders"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_clientId_poNumber_key" ON "purchase_orders"("clientId", "poNumber");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "goods_receipts_clientId_idx" ON "goods_receipts"("clientId");

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_clientId_receiptNumber_key" ON "goods_receipts"("clientId", "receiptNumber");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "admin_broadcasts_isActive_publishAt_idx" ON "admin_broadcasts"("isActive", "publishAt");

-- CreateIndex
CREATE INDEX "admin_broadcasts_createdAt_idx" ON "admin_broadcasts"("createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_idx" ON "support_messages"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "payday_configs_clientId_key" ON "payday_configs"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "payday_employees_employeeCode_key" ON "payday_employees"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "payday_employees_qrSecret_key" ON "payday_employees"("qrSecret");

-- CreateIndex
CREATE INDEX "payday_employees_clientId_idx" ON "payday_employees"("clientId");

-- CreateIndex
CREATE INDEX "payday_employees_nfcTagId_idx" ON "payday_employees"("nfcTagId");

-- CreateIndex
CREATE UNIQUE INDEX "payday_employees_clientId_cedula_key" ON "payday_employees"("clientId", "cedula");

-- CreateIndex
CREATE UNIQUE INDEX "authenticators_credentialID_key" ON "authenticators"("credentialID");

-- CreateIndex
CREATE INDEX "authenticators_employeeId_idx" ON "authenticators"("employeeId");

-- CreateIndex
CREATE INDEX "authenticators_clientId_idx" ON "authenticators"("clientId");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_idx" ON "attendance_records"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_records_shiftDate_idx" ON "attendance_records"("shiftDate");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payday_work_shifts_clientId_name_key" ON "payday_work_shifts"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "payday_work_groups_clientId_name_key" ON "payday_work_groups"("clientId", "name");

-- CreateIndex
CREATE INDEX "payday_schedule_assignments_workGroupId_idx" ON "payday_schedule_assignments"("workGroupId");

-- CreateIndex
CREATE INDEX "payday_schedule_assignments_employeeId_idx" ON "payday_schedule_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "payday_schedule_assignments_startDate_endDate_idx" ON "payday_schedule_assignments"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "task_records_employeeId_idx" ON "task_records"("employeeId");

-- CreateIndex
CREATE INDEX "payday_payroll_runs_clientId_idx" ON "payday_payroll_runs"("clientId");

-- CreateIndex
CREATE INDEX "payroll_items_payrollRunId_idx" ON "payroll_items"("payrollRunId");

-- CreateIndex
CREATE INDEX "payroll_items_employeeId_idx" ON "payroll_items"("employeeId");

-- CreateIndex
CREATE INDEX "upgrade_requests_clientId_idx" ON "upgrade_requests"("clientId");

-- CreateIndex
CREATE INDEX "upgrade_requests_status_idx" ON "upgrade_requests"("status");

-- CreateIndex
CREATE INDEX "kiosk_sessions_status_idx" ON "kiosk_sessions"("status");

-- CreateIndex
CREATE INDEX "cart_reservations_productId_idx" ON "cart_reservations"("productId");

-- CreateIndex
CREATE INDEX "cart_reservations_sessionId_idx" ON "cart_reservations"("sessionId");

-- CreateIndex
CREATE INDEX "cart_reservations_expiresAt_idx" ON "cart_reservations"("expiresAt");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_referenceId_referenceType_idx" ON "stock_movements"("referenceId", "referenceType");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE UNIQUE INDEX "pos_offline_transactions_localId_key" ON "pos_offline_transactions"("localId");

-- CreateIndex
CREATE INDEX "pos_offline_transactions_terminalId_idx" ON "pos_offline_transactions"("terminalId");

-- CreateIndex
CREATE INDEX "pos_offline_transactions_clientId_idx" ON "pos_offline_transactions"("clientId");

-- CreateIndex
CREATE INDEX "pos_offline_transactions_localId_idx" ON "pos_offline_transactions"("localId");

-- CreateIndex
CREATE INDEX "pos_offline_transactions_hasConflict_idx" ON "pos_offline_transactions"("hasConflict");

-- CreateIndex
CREATE INDEX "pos_offline_transactions_syncedAt_idx" ON "pos_offline_transactions"("syncedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hka_credentials" ADD CONSTRAINT "hka_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_assignments" ADD CONSTRAINT "folio_assignments_folioPoolId_fkey" FOREIGN KEY ("folioPoolId") REFERENCES "folio_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_assignments" ADD CONSTRAINT "folio_assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_consumptions" ADD CONSTRAINT "folio_consumptions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_logs" ADD CONSTRAINT "invoice_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_runs" ADD CONSTRAINT "monitor_runs_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_run_requests" ADD CONSTRAINT "monitor_run_requests_runId_fkey" FOREIGN KEY ("runId") REFERENCES "monitor_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitor_run_tests" ADD CONSTRAINT "monitor_run_tests_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "monitor_run_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_configs" ADD CONSTRAINT "payday_configs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_employees" ADD CONSTRAINT "payday_employees_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_employees" ADD CONSTRAINT "payday_employees_workGroupId_fkey" FOREIGN KEY ("workGroupId") REFERENCES "payday_work_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payday_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payday_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "payday_work_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_work_shifts" ADD CONSTRAINT "payday_work_shifts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_work_groups" ADD CONSTRAINT "payday_work_groups_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_schedule_assignments" ADD CONSTRAINT "payday_schedule_assignments_workGroupId_fkey" FOREIGN KEY ("workGroupId") REFERENCES "payday_work_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_schedule_assignments" ADD CONSTRAINT "payday_schedule_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payday_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_schedule_assignments" ADD CONSTRAINT "payday_schedule_assignments_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "payday_work_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_records" ADD CONSTRAINT "task_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payday_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payday_payroll_runs" ADD CONSTRAINT "payday_payroll_runs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payday_payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payday_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrade_requests" ADD CONSTRAINT "upgrade_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_reservations" ADD CONSTRAINT "cart_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
