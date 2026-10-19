import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/pay/qr_scanner.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// F23.4 · Pantalla "Estamos confirmando tu pago".
///
/// Cuando el estado del servidor es `UNKNOWN` la pantalla **nunca** dice "falló"
/// (`flutter-standards.md` §10.5): el pago puede haberse cobrado. Muestra que se está
/// confirmando, mantiene el sondeo y solo cambia a un estado terminal cuando el
/// servidor lo dice.
class ConfirmingPaymentScreen extends StatelessWidget {
  const ConfirmingPaymentScreen({
    super.key,
    required this.display,
    required this.amountMinor,
    required this.merchantName,
    this.onCancel,
    this.onRefresh,
  });

  final PaymentDisplay display;
  final int amountMinor;
  final String merchantName;
  final VoidCallback? onCancel;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final failed = display.isDefinitiveFailure;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.confirmingPaymentTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Icon(
              failed ? Icons.cancel_outlined : Icons.hourglass_top,
              size: 48,
              color: failed ? theme.colorScheme.error : theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              failed ? l10n.paymentFailedTitle : l10n.confirmingPaymentBody,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              merchantName,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            // El importe va con `MoneyText`: enteros minor, cifras tabulares (ADR 0013).
            Center(child: MoneyText(amountMinor, style: theme.textTheme.headlineSmall)),
            const SizedBox(height: 16),
            Center(
              child: StatusChip(
                label: _chipLabel(l10n, display),
                tone: failed ? StatusTone.error : StatusTone.warning,
              ),
            ),
            if (!failed) ...[
              const SizedBox(height: 24),
              Text(
                l10n.confirmingPaymentHint,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: failed
              ? PPButton.primary(label: l10n.actionDone, onPressed: onRefresh)
              // Mientras se confirma no hay acción destructiva a la vista: solo consultar.
              : PPButton.secondary(label: l10n.actionCheckStatus, onPressed: onRefresh),
        ),
      ),
    );
  }

  String _chipLabel(AppLocalizations l10n, PaymentDisplay d) => switch (d) {
        PaymentDisplay.pending => l10n.paymentStatusPending,
        PaymentDisplay.unknown => l10n.paymentStatusConfirming,
        PaymentDisplay.captured => l10n.paymentStatusCaptured,
        PaymentDisplay.failed => l10n.paymentStatusFailed,
        PaymentDisplay.refunded => l10n.paymentStatusRefunded,
        PaymentDisplay.unsupported => l10n.paymentStatusConfirming,
      };
}

/// F23.1 · Aviso de QR no reconocido.
///
/// El mensaje es el del análisis (`message`), ya traducido. Nunca se muestra el
/// contenido crudo del QR: podría contener datos que no deben llegar a la pantalla.
class QrRejectedScreen extends StatelessWidget {
  const QrRejectedScreen({super.key, required this.message, this.onDismiss});

  final String message;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(AppLocalizations.of(context).qrScannedTitle)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.qr_code_scanner, size: 48, color: theme.colorScheme.onSurface),
              const SizedBox(height: 16),
              Text(
                message,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge,
              ),
              const SizedBox(height: 24),
              PPButton.primary(
                label: AppLocalizations.of(context).actionClose,
                onPressed: onDismiss,
              ),
            ],
          ),
        ),
      ),
    );
  }
}