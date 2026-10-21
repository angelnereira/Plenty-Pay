import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../business/access_labels.dart' show reasonMessage;
import '../catalog/catalog_errors.dart' show catalogErrorMessage;

// Datos de facturación electrónica tal como los entrega el gateway (fiscal-invoicing, protojson con
// nombres snake_case, int64 como texto y enums por nombre).

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

int _money(Object? m) =>
    m is Map<String, dynamic> ? _int(m['amount_minor']) : 0;

/// Contribuyente frecuente (fiscal.Taxpayer).
class TaxpayerItem {
  const TaxpayerItem({
    required this.id,
    required this.taxId,
    required this.taxIdType,
    required this.checkDigit,
    required this.legalName,
    required this.email,
  });

  factory TaxpayerItem.fromJson(Map<String, dynamic> j) => TaxpayerItem(
        id: j['taxpayer_id'] as String? ?? '',
        taxId: j['tax_id'] as String? ?? '',
        taxIdType: j['tax_id_type'] as String? ?? '',
        checkDigit: j['check_digit'] as String? ?? '',
        legalName: j['legal_name'] as String? ?? '',
        email: j['email'] as String? ?? '',
      );

  final String id;
  final String taxId;
  final String taxIdType;
  final String checkDigit;
  final String legalName;
  final String email;

  bool get isRuc => taxIdType == 'RUC_JURIDICO' || taxIdType == 'RUC_NATURAL';

  Map<String, Object?> toJson() => {
        'tax_id': taxId,
        'tax_id_type': taxIdType,
        'check_digit': checkDigit,
        'legal_name': legalName,
        'email': email,
      };
}

/// Tipos de identificación del contrato (Taxpayer.tax_id_type), en el orden del formulario.
const taxIdTypes = [
  'RUC_JURIDICO',
  'RUC_NATURAL',
  'CEDULA',
  'PASAPORTE',
  'EXTRANJERO'
];

String taxIdTypeLabel(AppLocalizations l10n, String t) => switch (t) {
      'RUC_JURIDICO' => l10n.fiscalIdRucJuridico,
      'RUC_NATURAL' => l10n.fiscalIdRucNatural,
      'CEDULA' => l10n.fiscalIdCedula,
      'PASAPORTE' => l10n.fiscalIdPasaporte,
      _ => l10n.fiscalIdExtranjero,
    };

/// Línea de un documento.
class InvoiceLineItem {
  const InvoiceLineItem({
    required this.description,
    required this.quantityMilli,
    required this.unitPriceMinor,
    required this.discountMinor,
    required this.taxRateBps,
  });

  factory InvoiceLineItem.fromJson(Map<String, dynamic> j) => InvoiceLineItem(
        description: j['description'] as String? ?? '',
        quantityMilli: _int(j['quantity_milli']),
        unitPriceMinor: _money(j['unit_price']),
        discountMinor: _money(j['discount']),
        taxRateBps: _int(j['tax_rate_bps']),
      );

  final String description;
  final int quantityMilli;
  final int unitPriceMinor;
  final int discountMinor;
  final int taxRateBps;

  Map<String, Object?> toJson(String currency) => {
        'description': description,
        'quantity_milli': '$quantityMilli',
        'unit_price': {'amount_minor': '$unitPriceMinor', 'currency': currency},
        if (discountMinor > 0)
          'discount': {'amount_minor': '$discountMinor', 'currency': currency},
        'tax_rate_bps': taxRateBps,
      };
}

/// Totales que la app muestra antes de emitir. Usan la regla del servidor (R1): base =
/// half_up(qty × precio / 1000) − descuento; impuesto = half_up(base × tasa / 10000). Solo son una
/// vista previa: el servidor vuelve a calcular y manda.
({int subtotal, int tax, int total}) previewTotals(
    List<InvoiceLineItem> lines) {
  var subtotal = 0, tax = 0;
  for (final l in lines) {
    final gross = (l.quantityMilli * l.unitPriceMinor + 500) ~/ 1000;
    final base = gross - l.discountMinor;
    subtotal += base;
    tax += (base * l.taxRateBps + 5000) ~/ 10000;
  }
  return (subtotal: subtotal, tax: tax, total: subtotal + tax);
}

/// Documento fiscal (fiscal.Invoice).
class InvoiceItem {
  const InvoiceItem({
    required this.id,
    required this.documentType,
    required this.status,
    required this.folio,
    required this.cufe,
    required this.qr,
    required this.subtotalMinor,
    required this.taxMinor,
    required this.totalMinor,
    required this.currency,
    required this.customer,
    required this.lines,
    required this.relatedInvoiceId,
    required this.rejectionReason,
    required this.issuedAt,
  });

  factory InvoiceItem.fromJson(Map<String, dynamic> j) {
    final total = j['total'] as Map<String, dynamic>? ?? const {};
    final issued = j['issued_at'] as String?;
    final customer = j['customer'] as Map<String, dynamic>?;
    return InvoiceItem(
      id: j['invoice_id'] as String? ?? '',
      documentType: (j['document_type'] as String? ?? '')
          .replaceFirst('DOCUMENT_TYPE_', ''),
      status:
          (j['status'] as String? ?? '').replaceFirst('INVOICE_STATUS_', ''),
      folio: j['folio_number'] as String? ?? '',
      cufe: j['cufe'] as String? ?? '',
      qr: j['qr_url'] as String? ?? '',
      subtotalMinor: _money(j['subtotal']),
      taxMinor: _money(j['tax']),
      totalMinor: _money(total),
      currency: total['currency'] as String? ?? 'USD',
      customer:
          customer == null || (customer['tax_id'] as String? ?? '').isEmpty
              ? null
              : TaxpayerItem.fromJson(customer),
      lines: [
        for (final l in (j['lines'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>())
          InvoiceLineItem.fromJson(l),
      ],
      relatedInvoiceId: j['related_invoice_id'] as String? ?? '',
      rejectionReason: j['rejection_reason'] as String? ?? '',
      issuedAt:
          issued == null || issued.isEmpty ? null : DateTime.tryParse(issued),
    );
  }

  final String id;
  final String documentType; // FISCAL_INVOICE | CREDIT_NOTE | DEBIT_NOTE
  final String status; // QUEUED | SENT | ACCEPTED | REJECTED | VOIDED
  final String folio;
  final String cufe;
  final String qr;
  final int subtotalMinor;
  final int taxMinor;
  final int totalMinor;
  final String currency;
  final TaxpayerItem? customer;
  final List<InvoiceLineItem> lines;
  final String relatedInvoiceId;
  final String rejectionReason;
  final DateTime? issuedAt;

  bool get accepted => status == 'ACCEPTED';
  bool get pending =>
      status == 'QUEUED' || status == 'SENT' || status == 'DRAFT';
  bool get isInvoice => documentType == 'FISCAL_INVOICE';

  /// R9: el CUFE del simulador empieza por DEMO- (documento sin validez fiscal).
  bool get isDemo => cufe.startsWith('DEMO-');
}

String documentTypeLabel(AppLocalizations l10n, String t) => switch (t) {
      'CREDIT_NOTE' => l10n.fiscalDocCredit,
      'DEBIT_NOTE' => l10n.fiscalDocDebit,
      _ => l10n.fiscalDocInvoice,
    };

String invoiceStatusLabel(AppLocalizations l10n, String s) => switch (s) {
      'DRAFT' => l10n.fiscalStatusDraft,
      'QUEUED' => l10n.fiscalStatusQueued,
      'SENT' => l10n.fiscalStatusSent,
      'ACCEPTED' => l10n.fiscalStatusAccepted,
      'REJECTED' => l10n.fiscalStatusRejected,
      _ => l10n.fiscalStatusVoided,
    };

/// Perfil fiscal (fiscal.FiscalProfile).
class FiscalProfileItem {
  const FiscalProfileItem({
    required this.environment,
    required this.checkoutPreference,
    required this.autoThresholdMinor,
    required this.branchCode,
    required this.pointOfSaleCode,
    required this.pacProvider,
  });

  factory FiscalProfileItem.fromJson(Map<String, dynamic> j) =>
      FiscalProfileItem(
        environment: j['environment'] as String? ?? 'DEMO',
        checkoutPreference: j['checkout_preference'] as String? ??
            'CHECKOUT_PREFERENCE_ALWAYS_FISCAL',
        autoThresholdMinor: _int(j['auto_threshold_minor']),
        branchCode: j['branch_code'] as String? ?? '0000',
        pointOfSaleCode: j['point_of_sale_code'] as String? ?? '001',
        pacProvider: j['pac_provider'] as String? ?? 'simulator',
      );

  final String environment;
  final String checkoutPreference;
  final int autoThresholdMinor;
  final String branchCode;
  final String pointOfSaleCode;
  final String pacProvider;

  bool get isDemo => environment != 'PROD';
}

/// Carga el perfil; null si el negocio aún no tiene (PROFILE_MISSING).
Future<FiscalProfileItem?> loadFiscalProfile(ApiClient api) async {
  try {
    return FiscalProfileItem.fromJson(await api.getFiscalProfile());
  } on ApiException catch (e) {
    if (e.reason == 'PROFILE_MISSING') return null;
    rethrow;
  }
}

/// Mensaje para la persona a partir del reason (C-02).
String fiscalErrorMessage(AppLocalizations l10n, Object error) {
  if (error is ApiException) {
    switch (error.reason) {
      case 'PROFILE_MISSING':
        return l10n.error_PROFILE_MISSING;
      case 'INVALID_RUC':
        return l10n.error_INVALID_RUC;
      case 'INVALID_TAXPAYER':
        return l10n.error_INVALID_TAXPAYER;
      case 'TOTALS_MISMATCH':
        return l10n.error_TOTALS_MISMATCH;
      case 'PAC_NOT_CONFIGURED':
        return l10n.error_PAC_NOT_CONFIGURED;
      case 'RELATED_NOT_ACCEPTED':
        return l10n.error_RELATED_NOT_ACCEPTED;
      case 'EXCEEDS_ORIGINAL':
        return l10n.error_EXCEEDS_ORIGINAL;
      case 'INVALID_TAX_RATE':
      case 'DEPENDENCY_UNAVAILABLE':
      case 'IDEMPOTENCY_KEY_REUSED':
        return catalogErrorMessage(l10n, error);
    }
  }
  return reasonMessage(l10n, error);
}
