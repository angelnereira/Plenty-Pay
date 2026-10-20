import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';

/// Montos del contrato: enteros en unidades menores. protojson envía los `int64` como texto;
/// nunca se convierten a `double` (ADR 0013).
int minorUnits(Object? v) => switch (v) {
      final int n => n,
      final String s => int.tryParse(s) ?? 0,
      _ => 0,
    };

/// Saldo de la billetera (ledger `Balance`).
class WalletBalance {
  const WalletBalance(
      {required this.availableMinor,
      required this.heldMinor,
      required this.currency});

  factory WalletBalance.fromJson(Map<String, dynamic> j) => WalletBalance(
        availableMinor: minorUnits(j['available_minor']),
        heldMinor: minorUnits(j['held_minor']),
        currency:
            (j['account'] as Map<String, dynamic>?)?['currency'] as String? ??
                'USD',
      );

  final int availableMinor;
  final int heldMinor;
  final String currency;
}

/// Un movimiento del extracto (ledger `LedgerStatementLine`). La billetera es un pasivo: un
/// crédito suma al saldo y un débito resta.
class WalletLine {
  const WalletLine(
      {required this.transactionId,
      required this.transactionType,
      required this.description,
      required this.amountMinor,
      required this.effectiveAt});

  factory WalletLine.fromJson(Map<String, dynamic> j) {
    final entry = j['entry'] as Map<String, dynamic>? ?? const {};
    final amount = minorUnits(entry['amount_minor']);
    final credit = entry['side'] == 'ENTRY_SIDE_CREDIT';
    return WalletLine(
      transactionId: j['transaction_id'] as String? ?? '',
      transactionType: j['transaction_type'] as String? ?? '',
      description: j['description'] as String? ?? '',
      amountMinor: credit ? amount : -amount,
      effectiveAt:
          DateTime.tryParse(j['effective_at'] as String? ?? '')?.toLocal() ??
              DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  final String transactionId;
  final String transactionType;
  final String description;
  final int amountMinor;
  final DateTime effectiveAt;
}

class WalletSnapshot {
  const WalletSnapshot({required this.balance, required this.lines});
  final WalletBalance balance;

  /// Más reciente primero.
  final List<WalletLine> lines;
}

/// Días de movimientos que muestra S-WAL-01 por defecto (el rango máximo es 366).
const walletStatementDays = 30;

Future<WalletBalance> loadWalletBalance(ApiClient api) async =>
    WalletBalance.fromJson(await api.walletBalance());

Future<WalletSnapshot> loadWallet(ApiClient api, {DateTime? now}) async {
  final to = (now ?? DateTime.now()).toUtc();
  final results = await Future.wait([
    api.walletBalance(),
    api.walletStatement(
        from: to.subtract(const Duration(days: walletStatementDays)), to: to),
  ]);
  final lines = [
    for (final l in (results[1]['lines'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>())
      WalletLine.fromJson(l),
  ]..sort((a, b) => b.effectiveAt.compareTo(a.effectiveAt));
  return WalletSnapshot(
      balance: WalletBalance.fromJson(results[0]), lines: lines);
}

/// El ledger o el gateway aún no responden (contenedor sin desplegar o caído): la pantalla lo
/// dice en vez de mostrar un saldo.
bool walletUnavailable(Object error) =>
    error is ApiException &&
    (error.status == 503 ||
        error.status == 504 ||
        error.reason == 'SERVICE_UNAVAILABLE' ||
        error.reason == 'DEPENDENCY_UNAVAILABLE');

String walletErrorMessage(AppLocalizations l10n, Object error) {
  if (walletUnavailable(error)) return l10n.walletUnavailable;
  if (error is ApiException) return l10n.errorGeneric(error.reason);
  return l10n.errorNoConnection;
}

/// Nombre del tipo de asiento (domain-model §5.2) para la persona.
String transactionTypeLabel(AppLocalizations l10n, String type) =>
    switch (type) {
      'WALLET_TOPUP' => l10n.txType_WALLET_TOPUP,
      'WALLET_PAYMENT' => l10n.txType_WALLET_PAYMENT,
      'P2P_TRANSFER' => l10n.txType_P2P_TRANSFER,
      'PAYOUT_TO_WALLET' => l10n.txType_PAYOUT_TO_WALLET,
      'REFUND' => l10n.txType_REFUND,
      'PAYROLL_PAYMENT' => l10n.txType_PAYROLL_PAYMENT,
      'REVERSAL' => l10n.txType_REVERSAL,
      _ => l10n.txTypeOther,
    };

/// Fecha con el mes en texto (N-STD-10): «20 de octubre de 2026 · 08:40».
String walletDateTime(DateTime t, String locale) =>
    DateFormat('d MMMM y · HH:mm', locale).format(t);

/// Preferencia de ocultar el saldo (S-WAL-01 e1, S-GEN-05 e4): compartida entre Inicio y Billetera
/// mientras la app está abierta.
final hideWalletBalance = ValueNotifier<bool>(false);
