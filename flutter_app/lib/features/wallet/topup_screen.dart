import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'pay_data.dart';
import 'pay_result_screen.dart';

/// S-WAL-02 · `/wallet/topup` · Recargar. Permiso `wallet:topup`. Regla N-PAG-06.
///
/// e1 monto (mínimo $1.00) · e3 métodos con la etiqueta "Prueba" (todos los rieles son sandbox
/// mientras no haya credenciales, R13) · e4 desglose: la recarga no lleva comisión (T1) · e5
/// "Recargar {total}" → `POST /v1/wallet/topups` + confirmar → S-WAL-07. El tope por nivel (e2,
/// `/v1/me/limits`) llega con N-AML-03.
class TopupScreen extends StatefulWidget {
  const TopupScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<TopupScreen> createState() => _TopupScreenState();
}

/// Rieles de recarga habilitados por flag en infra-management (R17).
const _rails = ['PAYMENT_RAIL_YAPPY', 'PAYMENT_RAIL_TELERED_CLAVE'];

class _TopupScreenState extends State<TopupScreen> {
  final _amount = TextEditingController();
  String _rail = _rails.first;
  bool _busy = false;

  /// Misma clave al reintentar el mismo monto y método; nueva si cambian (grpc-conventions §3).
  String _key = newRequestId();

  static const _minimumMinor = 100;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  String _railLabel(AppLocalizations l10n, String rail) =>
      rail == 'PAYMENT_RAIL_YAPPY' ? l10n.railYappy : l10n.railClave;

  Future<void> _topup(int minor) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      final created = PayIntent.fromJson(await widget.api
          .createTopup(amountMinor: minor, rail: _rail, idempotencyKey: _key));
      PayIntent result;
      Object? failure;
      try {
        result = PayIntent.fromJson(await widget.api.confirmPaymentIntent(
            created.id,
            idempotencyKey: 'confirm:${created.id}'));
      } on ApiException catch (e) {
        failure = e;
        result =
            PayIntent.fromJson(await widget.api.getPaymentIntent(created.id));
      }
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
          builder: (_) => PayResultScreen(
              api: widget.api,
              intent: result,
              merchantName: l10n.topupResult(_railLabel(l10n, _rail)),
              totalMinor: minor,
              failure: failure)));
    } on Object catch (e) {
      widget.api.logger
          .breadcrumb('ui', 'topup', e is ApiException ? e.reason : 'network');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(payErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final minor = MoneyText.parse(_amount.text);
    final valid = minor != null && minor >= _minimumMinor;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.topupTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
        children: [
          TextField(
            controller: _amount,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: l10n.topupHowMuch,
              prefixText: r'$ ',
              errorText:
                  _amount.text.isNotEmpty && !valid ? l10n.topupMinimum : null,
            ),
            onChanged: (_) => setState(() => _key = newRequestId()),
          ),
          const SizedBox(height: AppTokens.spacingLg),
          Text(l10n.topupMethod, style: theme.textTheme.titleSmall),
          const SizedBox(height: AppTokens.spacingSm),
          Card(
            margin: EdgeInsets.zero,
            elevation: 0,
            color: theme.colorScheme.surfaceContainerLow,
            child: Column(children: [
              for (final rail in _rails)
                ListTile(
                  leading: Icon(_rail == rail
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked),
                  title: Text(_railLabel(l10n, rail)),
                  trailing: StatusChip(
                      label: l10n.railSandbox, tone: StatusTone.warning),
                  selected: _rail == rail,
                  onTap: () => setState(() {
                    _rail = rail;
                    _key = newRequestId();
                  }),
                ),
            ]),
          ),
          if (valid) ...[
            const SizedBox(height: AppTokens.spacingLg),
            _Line(label: l10n.topupAmountLine, minor: minor),
            _Line(label: l10n.topupFeeLine, minor: 0),
            const Divider(),
            _Line(label: l10n.topupTotalLine, minor: minor, strong: true),
          ],
          const SizedBox(height: AppTokens.spacingLg),
          PPButton.primary(
            label: valid
                ? l10n.topupButton(MoneyText.format(minor))
                : l10n.topupTitle,
            loading: _busy,
            onPressed: valid && !_busy ? () => _topup(minor) : null,
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.minor, this.strong = false});
  final String label;
  final int minor;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final style = strong
        ? Theme.of(context).textTheme.titleMedium
        : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppTokens.spacingXs),
      child: Row(children: [
        Expanded(child: Text(label, style: style)),
        MoneyText(minor, style: style),
      ]),
    );
  }
}
