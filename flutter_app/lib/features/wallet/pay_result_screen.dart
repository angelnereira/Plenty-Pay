import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/pay/qr_scanner.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'pay_data.dart';
import 'wallet_data.dart';

/// S-WAL-07 · `/pay/result/:intent` · Resultado. Tres variantes: Éxito, Rechazado y
/// Confirmando. Mientras se confirma no hay botón de atrás y la pantalla consulta el intent
/// hasta un estado final (el aviso por WebSocket `payment.status` llega con F20). UNKNOWN
/// nunca se muestra como "Rechazado" (domain-model §6.3).
class PayResultScreen extends StatefulWidget {
  const PayResultScreen(
      {super.key,
      required this.api,
      required this.intent,
      required this.merchantName,
      required this.totalMinor,
      this.failure,
      this.pollEvery = const Duration(seconds: 3)});

  final ApiClient api;
  final PayIntent intent;
  final String merchantName;
  final int totalMinor;

  /// Motivo del rechazo de ConfirmPaymentIntent, si lo hubo.
  final Object? failure;
  final Duration pollEvery;

  @override
  State<PayResultScreen> createState() => _PayResultScreenState();
}

class _PayResultScreenState extends State<PayResultScreen> {
  late PayIntent _intent = widget.intent;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    if (_intent.display.isStillConfirming) {
      _poll = Timer.periodic(widget.pollEvery, (_) => _refresh());
    }
  }

  Future<void> _refresh() async {
    try {
      final next =
          PayIntent.fromJson(await widget.api.getPaymentIntent(_intent.id));
      if (!mounted) return;
      setState(() => _intent = next);
      if (!next.display.isStillConfirming) _poll?.cancel();
    } on Object catch (e) {
      // Se sigue consultando: un fallo de red no cambia el estado del pago.
      widget.api.logger.breadcrumb(
          'ui', 'pay.result.poll', e is ApiException ? e.reason : 'network');
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _home() => Navigator.of(context).popUntil((r) => r.isFirst);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final display = _intent.display;
    final confirming = display.isStillConfirming;
    final failed = display.isDefinitiveFailure;
    final locale = Localizations.localeOf(context).toString();

    final (icon, color, title) = failed
        ? (Icons.error_outline, theme.colorScheme.error, l10n.payResultFailed)
        : confirming
            ? (
                Icons.schedule,
                theme.colorScheme.tertiary,
                l10n.payResultConfirming
              )
            : (
                Icons.check_circle_outline,
                theme.colorScheme.primary,
                l10n.payResultSuccess
              );

    return PopScope(
      canPop: !confirming,
      child: Scaffold(
        appBar: AppBar(automaticallyImplyLeading: !confirming),
        body: SafeArea(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingLg, margin, AppTokens.spacingLg),
            children: [
              Icon(icon, size: AppTokens.spacingXl * 2, color: color),
              const SizedBox(height: AppTokens.spacingMd),
              Text(title,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall),
              const SizedBox(height: AppTokens.spacingMd),
              Center(
                  child: MoneyText(widget.totalMinor,
                      style: theme.textTheme.headlineMedium)),
              const SizedBox(height: AppTokens.spacingSm),
              Text(
                  '${widget.merchantName} · ${walletDateTime(DateTime.now(), locale)}',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium),
              if (_intent.sandbox) ...[
                const SizedBox(height: AppTokens.spacingSm),
                Center(
                    child: StatusChip(
                        label: l10n.walletSandbox, tone: StatusTone.warning)),
              ],
              const SizedBox(height: AppTokens.spacingMd),
              if (!failed && !confirming && _intent.paymentId.isNotEmpty)
                Text(
                    l10n.payResultReference(
                        _intent.paymentId.substring(0, 8).toUpperCase()),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall),
              if (failed) ...[
                if (widget.failure != null)
                  Text(payErrorMessage(l10n, widget.failure!),
                      textAlign: TextAlign.center),
                const SizedBox(height: AppTokens.spacingXs),
                Text(l10n.payResultNotCharged, textAlign: TextAlign.center),
              ],
              if (confirming)
                Text(l10n.payResultConfirmingBody, textAlign: TextAlign.center),
              const SizedBox(height: AppTokens.spacingLg),
              if (failed)
                PPButton.primary(
                    label: l10n.actionTryAgain,
                    onPressed: () => Navigator.of(context).pop())
              else
                PPButton.primary(
                    label: confirming ? l10n.actionUnderstood : l10n.actionDone,
                    onPressed: _home),
            ],
          ),
        ),
      ),
    );
  }
}

/// Estado mostrado para un intent (expuesto para pruebas).
PaymentDisplay displayOf(PayIntent i) => i.display;
