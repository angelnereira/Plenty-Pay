import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

/// Mensaje traducido de un fallo de catálogo, inventario o caja (C-08): el usuario ve el texto del
/// `reason`, nunca el detalle técnico. Sin servicio (503) dice que el módulo no está disponible.
String catalogErrorMessage(AppLocalizations l10n, Object error) {
  if (error is! ApiException) return l10n.errorNoConnection;
  if (error.status == 503 && error.reason != 'DEPENDENCY_UNAVAILABLE') {
    return l10n.catUnavailable;
  }
  return switch (error.reason) {
    'DEPENDENCY_UNAVAILABLE' || 'SERVICE_UNAVAILABLE' => l10n.catUnavailable,
    'SKU_TAKEN' => l10n.error_SKU_TAKEN,
    'BARCODE_TAKEN' => l10n.error_BARCODE_TAKEN,
    'INVALID_BARCODE' => l10n.error_INVALID_BARCODE,
    'INVALID_TAX_RATE' => l10n.error_INVALID_TAX_RATE,
    'TAX_TREATMENT_MISSING' => l10n.error_TAX_TREATMENT_MISSING,
    'CATEGORY_DEPTH_EXCEEDED' => l10n.error_CATEGORY_DEPTH_EXCEEDED,
    'VERSION_CONFLICT' => l10n.error_VERSION_CONFLICT,
    'ALREADY_EXISTS' => l10n.error_ALREADY_EXISTS,
    'INVALID_REQUEST' => l10n.error_INVALID_REQUEST,
    'OUT_OF_STOCK' => l10n.error_OUT_OF_STOCK,
    'EXCEEDS_BLOCKED' => l10n.error_EXCEEDS_BLOCKED,
    'LOT_REQUIRED' => l10n.error_LOT_REQUIRED,
    'LOT_EXPIRED' => l10n.error_LOT_EXPIRED,
    'LOT_NOT_FOUND' => l10n.error_LOT_NOT_FOUND,
    'LOTS_REQUIRE_INVENTORY' => l10n.error_LOTS_REQUIRE_INVENTORY,
    'MOVEMENT_REASON_REQUIRED' => l10n.error_MOVEMENT_REASON_REQUIRED,
    'VARIANT_NOT_FOUND' => l10n.error_VARIANT_NOT_FOUND,
    'INVENTORY_NOT_TRACKED' => l10n.error_INVENTORY_NOT_TRACKED,
    'SAME_WAREHOUSE' => l10n.error_SAME_WAREHOUSE,
    'INVALID_WAREHOUSE' => l10n.error_INVALID_WAREHOUSE,
    'BRANCH_OUT_OF_SCOPE' => l10n.error_BRANCH_OUT_OF_SCOPE,
    'IDEMPOTENCY_KEY_REUSED' => l10n.error_IDEMPOTENCY_KEY_REUSED,
    'SESSION_ALREADY_OPEN' => l10n.error_SESSION_ALREADY_OPEN,
    'SESSION_CLOSED' => l10n.error_SESSION_CLOSED,
    'NOT_SESSION_OWNER' => l10n.error_NOT_SESSION_OWNER,
    'SALES_PENDING' => l10n.error_SALES_PENDING,
    'EMPTY_SALE' => l10n.error_EMPTY_SALE,
    'TENDERS_MISMATCH' => l10n.error_TENDERS_MISMATCH,
    'RAIL_NOT_SUPPORTED' => l10n.error_RAIL_NOT_SUPPORTED,
    'PRODUCT_NOT_FOUND' => l10n.error_PRODUCT_NOT_FOUND,
    'DISCOUNT_EXCEEDS_LIMIT' => l10n.error_DISCOUNT_EXCEEDS_LIMIT,
    'HAS_CAPTURED_PAYMENTS' => l10n.error_HAS_CAPTURED_PAYMENTS,
    'REASON_REQUIRED' => l10n.error_REASON_REQUIRED,
    'EXCEEDS_SOLD_QTY' => l10n.error_EXCEEDS_SOLD_QTY,
    'STEP_UP_REQUIRED' => l10n.error_STEP_UP_REQUIRED,
    'STEP_UP_INVALID' => l10n.error_STEP_UP_INVALID,
    'TENANT_REQUIRED' => l10n.error_TENANT_REQUIRED,
    'INVALID_STATE_TRANSITION' => l10n.error_INVALID_STATE_TRANSITION,
    'PERMISSION_DENIED' => l10n.error_PERMISSION_DENIED,
    'FILE_TOO_LARGE' => l10n.error_FILE_TOO_LARGE,
    'UNSUPPORTED_FILE_TYPE' => l10n.error_UNSUPPORTED_FILE_TYPE,
    _ => l10n.errorGeneric(error.reason),
  };
}
