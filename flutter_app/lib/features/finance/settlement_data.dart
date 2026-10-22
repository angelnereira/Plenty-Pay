
import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../business/access_labels.dart' show reasonMessage;
import '../../core/format/dates.dart';

// Liquidaciones tal como las entrega el gateway (settlement, protojson con nombres snake_case,
// int64 como texto y enums por nombre). Los montos son centavos enteros (ADR 0013).

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

int _money(Object? m) =>
    m is Map<String, dynamic> ? _int(m['amount_minor']) : 0;

DateTime? _date(Object? v) => DateTime.tryParse('${v ?? ''}')?.toLocal();

/// Fecha con el mes en texto (N-STD-10): «23 de octubre de 2026».
String settlementDate(DateTime t, String locale) =>
    longDate(t, locale);

/// Fecha y hora con el mes en texto: «23 de octubre de 2026 · 17:00».
String settlementDateTime(DateTime t, String locale) =>
    longDateTime(t, locale);

/// Cabecera de S-FIN-05 (settlement.PayoutSummary).
class PayoutSummaryItem {
  const PayoutSummaryItem(
      {required this.pendingMinor,
      required this.processingMinor,
      this.nextPayoutAt});

  factory PayoutSummaryItem.fromJson(Map<String, dynamic> j) =>
      PayoutSummaryItem(
        pendingMinor: _money(j['pending']),
        processingMinor: _money(j['in_processing']),
        nextPayoutAt: _date(j['next_payout_at']),
      );

  final int pendingMinor;
  final int processingMinor;
  final DateTime? nextPayoutAt;
}

/// Calendario y destino (settlement.PayoutSchedule). El número de cuenta nunca llega: solo los
/// últimos 4.
class PayoutScheduleItem {
  const PayoutScheduleItem({
    required this.configured,
    required this.frequency,
    required this.weekday,
    required this.minimumMinor,
    required this.destinationKind,
    required this.bank,
    required this.accountType,
    required this.last4,
    required this.holder,
    required this.holdDays,
    this.blockedUntil,
  });

  factory PayoutScheduleItem.fromJson(Map<String, dynamic> j) =>
      PayoutScheduleItem(
        configured: j['configured'] as bool? ?? false,
        frequency: j['frequency'] as String? ?? 'PAYOUT_FREQUENCY_MANUAL',
        weekday: _int(j['weekday']),
        minimumMinor: _int(j['minimum_payout_minor']),
        destinationKind: j['destination_kind'] as String? ?? 'WALLET',
        bank: j['destination_bank'] as String? ?? '',
        accountType: j['destination_account_type'] as String? ?? '',
        last4: j['destination_last4'] as String? ?? '',
        holder: j['destination_holder'] as String? ?? '',
        holdDays: _int(j['hold_days']),
        blockedUntil: _date(j['payouts_blocked_until']),
      );

  final bool configured;
  final String frequency;
  final int weekday;
  final int minimumMinor;
  final String destinationKind;
  final String bank;
  final String accountType;
  final String last4;
  final String holder;
  final int holdDays;
  final DateTime? blockedUntil;

  bool get isBank => destinationKind == 'BANK';
}

/// Partida de un lote (settlement.SettlementItem).
class SettlementLineItem {
  const SettlementLineItem(
      {required this.kind,
      required this.referenceId,
      required this.amountMinor,
      this.occurredAt});

  factory SettlementLineItem.fromJson(Map<String, dynamic> j) =>
      SettlementLineItem(
        kind: j['kind'] as String? ?? '',
        referenceId:
            (j['reference'] as Map<String, dynamic>?)?['id'] as String? ?? '',
        amountMinor: _money(j['amount']),
        occurredAt: _date(j['occurred_at']),
      );

  final String kind; // PAYMENT | REFUND
  final String referenceId;
  final int amountMinor;
  final DateTime? occurredAt;

  bool get isRefund => kind == 'REFUND';
}

/// Lote de liquidación (settlement.SettlementBatch).
class SettlementBatchItem {
  const SettlementBatchItem({
    required this.id,
    required this.status,
    required this.grossMinor,
    required this.refundsMinor,
    required this.netMinor,
    required this.destinationKind,
    required this.last4,
    required this.sandbox,
    required this.externalRef,
    required this.failureReason,
    required this.itemCount,
    required this.items,
    this.createdAt,
    this.paidAt,
  });

  factory SettlementBatchItem.fromJson(Map<String, dynamic> j) =>
      SettlementBatchItem(
        id: j['batch_id'] as String? ?? '',
        status:
            (j['status'] as String? ?? '').replaceFirst('BATCH_STATUS_', ''),
        grossMinor: _money(j['gross']),
        refundsMinor: _money(j['refunds']),
        netMinor: _money(j['net_payout']),
        destinationKind: j['destination_kind'] as String? ?? '',
        last4: j['destination_last4'] as String? ?? '',
        sandbox: j['sandbox'] as bool? ?? false,
        externalRef: j['payout_external_ref'] as String? ?? '',
        failureReason: j['failure_reason'] as String? ?? '',
        itemCount: _int(j['item_count']),
        items: [
          for (final i in (j['items'] as List<dynamic>? ?? const []))
            SettlementLineItem.fromJson(i as Map<String, dynamic>)
        ],
        createdAt: _date(j['created_at']),
        paidAt: _date(j['paid_at']),
      );

  final String id;
  final String status; // OPEN | PROCESSING | PAID | FAILED
  final int grossMinor;
  final int refundsMinor;
  final int netMinor;
  final String destinationKind;
  final String last4;
  final bool sandbox;
  final String externalRef;
  final String failureReason;
  final int itemCount;
  final List<SettlementLineItem> items;
  final DateTime? createdAt;
  final DateTime? paidAt;

  /// «Número» visible del lote: los primeros 8 caracteres de su id.
  String get shortId => id.length > 8 ? id.substring(0, 8).toUpperCase() : id;
}

String batchStatusLabel(AppLocalizations l10n, String status) =>
    switch (status) {
      'OPEN' => l10n.batchStatusOpen,
      'PROCESSING' => l10n.batchStatusProcessing,
      'PAID' => l10n.batchStatusPaid,
      _ => l10n.batchStatusFailed,
    };

/// Destino visible: banco enmascarado o billetera.
String destinationLabel(AppLocalizations l10n, String kind, String last4) =>
    kind == 'BANK'
        ? l10n.payoutDestinationBankMasked(last4)
        : l10n.payoutDestinationWallet;

/// Mensaje para la persona a partir del reason (C-02).
String settlementErrorMessage(AppLocalizations l10n, Object error) {
  if (error is ApiException) {
    switch (error.reason) {
      case 'NOTHING_TO_SETTLE':
        return l10n.error_NOTHING_TO_SETTLE;
      case 'BELOW_MINIMUM':
        return l10n.error_BELOW_MINIMUM;
      case 'SANDBOX_FUNDS':
        return l10n.error_SANDBOX_FUNDS;
      case 'PAYOUTS_BLOCKED':
        return l10n.error_PAYOUTS_BLOCKED;
      case 'INVALID_DESTINATION':
        return l10n.error_INVALID_DESTINATION;
      case 'CONCURRENT_BATCH':
        return l10n.error_CONCURRENT_BATCH;
    }
  }
  return reasonMessage(l10n, error);
}
