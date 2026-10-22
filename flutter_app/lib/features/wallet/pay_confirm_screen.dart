import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../auth/step_up_dialog.dart';
import 'pay_data.dart';
import 'pay_result_screen.dart';
import 'topup_screen.dart';
import 'wallet_data.dart';

/// S-WAL-06 · `/pay/:code` · Confirmar pago. Permiso `wallet:pay`. Reglas N-CON-01, N-PAG-06.
///
/// e1 comercio VERIFICADO por el servidor · e2 monto · e3 saldo PlentyPay (deshabilitado si no
/// alcanza) · e4 desglose de `/v1/payments/quote` · e6 "Pagar {total}". El step-up se pide solo si
/// payments-core responde `STEP_UP_REQUIRED` (el umbral vive en infra-management, no en la app).
/// e5 (factura con RUC) llega con F13.
///
/// F11.10: si el código es el personal de alguien, es un envío (S-WAL-03): persona verificada
/// abreviada, sin comisión (se envía exactamente el monto) y permiso `wallet:transfer`.
class PayConfirmScreen extends StatefulWidget {
  const PayConfirmScreen(
      {super.key,
      required this.api,
      required this.code,
      this.saleId,
      this.amountMinor});
  final ApiClient api;
  final String code;

  /// QR de una venta de caja: el monto viene fijado por la caja y el pago lleva la referencia de
  /// la venta (S-POS-03 e4).
  final String? saleId;
  final int? amountMinor;

  @override
  State<PayConfirmScreen> createState() => _PayConfirmScreenState();
}

class _Loaded {
  const _Loaded(this.link, this.balance);
  final PayLink link;
  final WalletBalance balance;
}

class _PayConfirmScreenState extends State<PayConfirmScreen> {
  late Future<_Loaded> _future = _load();
  final _amount = TextEditingController();
  Timer? _debounce;
  PayQuote? _quote;
  Object? _quoteError;
  bool _paying = false;

  /// null hasta que el servidor dice a quién lleva el código; mientras tanto no se cotiza.
  bool? _isPerson;

  /// Una clave por intento de pago: se reutiliza al reintentar el mismo monto y se renueva al
  /// cambiarlo (grpc-conventions §3).
  String _createKey = newRequestId();

  @override
  void initState() {
    super.initState();
    final fixed = widget.amountMinor;
    if (fixed != null) {
      _amount.text = MoneyText.format(fixed, symbol: '');
    }
  }

  Future<_Loaded> _load() async {
    final results = await Future.wait(
        [widget.api.resolvePayLink(widget.code), widget.api.walletBalance()]);
    final loaded = _Loaded(PayLink.fromJson(widget.code, results[0]),
        WalletBalance.fromJson(results[1]));
    if (mounted) {
      setState(() => _isPerson = loaded.link.isPerson);
      if (_amount.text.isNotEmpty) _onAmountChanged(_amount.text);
    }
    return loaded;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _amount.dispose();
    super.dispose();
  }

  void _onAmountChanged(String text) {
    _debounce?.cancel();
    _createKey = newRequestId();
    final minor = MoneyText.parse(text);
    setState(() {
      _quote = null;
      _quoteError = null;
    });
    if (minor == null || minor <= 0 || _isPerson == null) return;
    if (_isPerson!) {
      setState(() => _quote = PayQuote.free(minor));
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final q = PayQuote.fromJson(minor, await widget.api.quoteFees(minor));
        if (mounted && MoneyText.parse(_amount.text) == minor) {
          setState(() => _quote = q);
        }
      } on Object catch (e) {
        widget.api.logger.breadcrumb(
            'ui', 'pay.quote', e is ApiException ? e.reason : 'network');
        if (mounted) setState(() => _quoteError = e);
      }
    });
  }

  Future<Map<String, dynamic>> _create(PayQuote q, String? token) =>
      widget.api.createPaymentIntent(
          terminalCode: widget.code,
          amountMinor: q.baseMinor,
          idempotencyKey: _createKey,
          stepUpToken: token,
          saleId: widget.saleId);

  Future<void> _pay(_Loaded data, PayQuote q) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _paying = true);
    try {
      Map<String, dynamic> created;
      try {
        created = await _create(q, null);
      } on ApiException catch (e) {
        if (e.reason != 'STEP_UP_REQUIRED' || !mounted) rethrow;
        final token = await StepUpDialog.obtainToken(context,
            api: widget.api,
            operation: stepUpPaymentCreate,
            amountMinor: q.totalMinor,
            currency: 'USD',
            title: l10n.payStepUpTitle(data.link.merchantName));
        if (token == null) return;
        created = await _create(q, token);
      }
      final intent = PayIntent.fromJson(created);
      PayIntent result;
      Object? failure;
      try {
        result = PayIntent.fromJson(await widget.api.confirmPaymentIntent(
            intent.id,
            idempotencyKey: 'confirm:${intent.id}'));
      } on ApiException catch (e) {
        // Rechazo definitivo (p. ej. saldo insuficiente): el pago quedó FAILED, sin cobro.
        failure = e;
        result =
            PayIntent.fromJson(await widget.api.getPaymentIntent(intent.id));
      }
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
          builder: (_) => PayResultScreen(
              api: widget.api,
              intent: result,
              merchantName: data.link.merchantName,
              totalMinor: q.totalMinor,
              failure: failure)));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pay.confirm', e is ApiException ? e.reason : 'network');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(payErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(
          title: Text(_isPerson ?? false ? l10n.sendTitle : l10n.walletPay)),
      body: FutureBuilder<_Loaded>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
          children: [
            AsyncView<_Loaded>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? payErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, data) => _body(context, data),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context, _Loaded data) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final q = _quote;
    final insufficient =
        q != null && q.totalMinor > data.balance.availableMinor;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // e1: siempre del servidor.
      Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: theme.colorScheme.surfaceContainerHigh,
        child: ListTile(
          leading: Icon(
              data.link.isPerson ? Icons.verified_user : Icons.verified,
              color: theme.colorScheme.primary,
              semanticLabel: data.link.isPerson
                  ? l10n.payVerifiedPerson
                  : l10n.payVerifiedMerchant),
          title:
              Text(data.link.merchantName, style: theme.textTheme.titleMedium),
          subtitle: Text(data.link.isPerson
              ? l10n.payVerifiedPerson
              : data.link.label),
        ),
      ),
      const SizedBox(height: AppTokens.spacingLg),
      // e2
      TextField(
        controller: _amount,
        autofocus: widget.amountMinor == null,
        readOnly: widget.amountMinor != null,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: InputDecoration(
          labelText: l10n.fieldAmount,
          prefixText: r'$ ',
          helperText: widget.saleId != null ? l10n.paySaleAt : null,
          errorText: _amount.text.isNotEmpty &&
                  (MoneyText.parse(_amount.text) ?? 0) <= 0
              ? l10n.payAmountInvalid
              : null,
        ),
        onChanged: _onAmountChanged,
      ),
      const SizedBox(height: AppTokens.spacingMd),
      // e3
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.account_balance_wallet_outlined),
        title: Text(
            l10n.payWithBalance(MoneyText.format(data.balance.availableMinor))),
        subtitle: insufficient
            ? Text(l10n.payInsufficient,
                style: TextStyle(color: theme.colorScheme.error))
            : null,
        trailing: insufficient
            ? TextButton(
                onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                        builder: (_) => TopupScreen(api: widget.api))),
                child: Text(l10n.topupTitle))
            : null,
      ),
      if (_quoteError != null)
        Text(payErrorMessage(l10n, _quoteError!),
            style: TextStyle(color: theme.colorScheme.error)),
      // e4
      if (q != null) ...[
        const SizedBox(height: AppTokens.spacingSm),
        if (data.link.isPerson)
          Text(l10n.sendNoFee, style: theme.textTheme.bodyMedium)
        else
          _Line(label: l10n.payBreakdownPurchase, minor: q.baseMinor),
        if (q.customerPaysFees) ...[
          _Line(label: l10n.payBreakdownFee, minor: q.platformFeeMinor),
          _Line(label: l10n.payBreakdownTax, minor: q.taxMinor),
        ],
        const Divider(),
        _Line(label: l10n.payBreakdownTotal, minor: q.totalMinor, strong: true),
      ],
      const SizedBox(height: AppTokens.spacingLg),
      // e6
      PPButton.primary(
        label: q == null
            ? (data.link.isPerson ? l10n.sendTitle : l10n.walletPay)
            : data.link.isPerson
                ? l10n.sendButton(MoneyText.format(q.totalMinor))
                : l10n.payButton(MoneyText.format(q.totalMinor)),
        loading: _paying,
        onPressed:
            q == null || insufficient || _paying ? null : () => _pay(data, q),
      ),
    ]);
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
      // Wrap: con texto grande o montos largos el monto baja a otra línea en vez de desbordar.
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        spacing: AppTokens.spacingSm,
        children: [
          Text(label, style: style),
          MoneyText(minor, style: style),
        ],
      ),
    );
  }
}
