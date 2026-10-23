import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../catalog/catalog_errors.dart';
import 'pos_data.dart';
import 'pos_receipt_screen.dart';

/// S-POS-03 · `/pos/sell/pay` · Cobro. `pos:sell` · `POST /v1/pos/sales/{id}/checkout`.
///
/// e1 Total y Falta, e2 medios activos hoy (Efectivo y Saldo PlentyPay), e3 recibido y vuelto con
/// atajo de monto exacto, e4 QR en pantalla con "Esperando al cliente…" (la venta se cierra sola
/// cuando payments-core confirma el cobro), e10 "Finalizar venta". Tarjeta, crédito de la casa,
/// puntos y propina esperan a sus servicios (Q-02, Q-03, F17.6).
class PosCheckoutScreen extends StatefulWidget {
  const PosCheckoutScreen(
      {super.key,
      required this.api,
      required this.sale,
      required this.terminalLabel,
      this.pollEvery = const Duration(seconds: 2)});
  final ApiClient api;
  final SaleItem sale;
  final String terminalLabel;
  final Duration pollEvery;

  @override
  State<PosCheckoutScreen> createState() => _PosCheckoutScreenState();
}

class _PosCheckoutScreenState extends State<PosCheckoutScreen> {
  final _cash = TextEditingController();
  final _received = TextEditingController();
  final _key = newRequestId();
  bool _useWallet = false;
  bool _sending = false;
  String? _error;
  SaleItem? _waiting;
  Timer? _poll;

  /// F17.11 (R14): medios activos de la caja. Mientras carga (o si no responde) se ofrecen los dos
  /// y el servidor decide: un medio apagado responde RAIL_NOT_SUPPORTED.
  PosSettingsItem _settings = PosSettingsItem.defaults;

  @override
  void initState() {
    super.initState();
    loadPosSettings(widget.api).then((s) {
      if (!mounted) return;
      setState(() {
        _settings = s;
        // Sin efectivo, todo el cobro va por saldo PlentyPay.
        if (!s.cashEnabled && s.walletEnabled) {
          _useWallet = true;
          _cash.text = '0.00';
        }
      });
    }, onError: (Object e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.settings', e is ApiException ? e.reason : 'network');
    });
  }

  int get _total => widget.sale.totalMinor;
  int get _cashMinor =>
      _useWallet ? (MoneyText.parse(_cash.text) ?? 0) : _total;
  int get _walletMinor => _useWallet ? _total - _cashMinor : 0;
  int get _receivedMinor => _received.text.trim().isEmpty
      ? _cashMinor
      : (MoneyText.parse(_received.text) ?? 0);
  int get _changeMinor => _receivedMinor - _cashMinor;

  @override
  void dispose() {
    _poll?.cancel();
    _cash.dispose();
    _received.dispose();
    super.dispose();
  }

  String? get _validation {
    final l10n = AppLocalizations.of(context);
    if (_cashMinor < 0 || _walletMinor < 0) return l10n.error_TENDERS_MISMATCH;
    if (_cashMinor > 0 && _receivedMinor < _cashMinor) return l10n.posCashShort;
    return null;
  }

  Future<void> _finish() async {
    final l10n = AppLocalizations.of(context);
    if (_validation != null) {
      setState(() => _error = _validation);
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final sale = SaleItem.fromJson(await widget.api.checkoutSale(
        widget.sale.id,
        [
          if (_cashMinor > 0)
            (
              rail: 'PAYMENT_RAIL_CASH',
              amountMinor: _cashMinor,
              cashTenderedMinor: _receivedMinor
            ),
          if (_walletMinor > 0)
            (
              rail: 'PAYMENT_RAIL_WALLET',
              amountMinor: _walletMinor,
              cashTenderedMinor: 0
            ),
        ],
        idempotencyKey: _key,
      ));
      if (!mounted) return;
      if (sale.isPaid) {
        _toReceipt(sale);
      } else {
        setState(() => _waiting = sale);
        _poll = Timer.periodic(widget.pollEvery, (_) => _check());
      }
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.checkout', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  /// Consulta la venta hasta que el cobro de billetera se confirme o falle.
  Future<void> _check() async {
    try {
      final sale = SaleItem.fromJson(await widget.api.getSale(widget.sale.id));
      if (!mounted) return;
      if (sale.isPaid) {
        _poll?.cancel();
        _toReceipt(sale);
      } else if (sale.walletFailed || sale.status == 'OPEN') {
        _poll?.cancel();
        setState(() {
          _waiting = null;
          _error = AppLocalizations.of(context).posWalletFailed;
        });
      }
    } on Object catch (e) {
      // Un fallo de red al consultar no cambia nada: se reintenta en la siguiente vuelta.
      widget.api.logger.breadcrumb(
          'ui', 'pos.poll', e is ApiException ? e.reason : 'network');
    }
  }

  void _toReceipt(SaleItem sale) {
    Navigator.of(context).pushReplacement(MaterialPageRoute<bool>(
        builder: (_) => PosReceiptScreen(
            api: widget.api,
            sale: sale,
            terminalLabel: widget.terminalLabel,
            closeReturns: true)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final waiting = _waiting;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posPayTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
        children: [
          Text(l10n.posTotal, style: theme.textTheme.labelLarge),
          MoneyText(_total, style: theme.textTheme.displaySmall),
          const SizedBox(height: AppTokens.spacingLg),
          if (waiting != null) ...[
            Center(
              child: Container(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                decoration: BoxDecoration(
                  color: Tokens.lightSurface,
                  borderRadius: BorderRadius.circular(AppTokens.radiusLg),
                ),
                child: QrImageView(
                  data: waiting.pendingWalletQr,
                  size: AppTokens.spacingXl * 7,
                  eyeStyle: const QrEyeStyle(
                      eyeShape: QrEyeShape.square, color: Tokens.lightText),
                  dataModuleStyle: const QrDataModuleStyle(
                      dataModuleShape: QrDataModuleShape.square,
                      color: Tokens.lightText),
                  semanticsLabel:
                      l10n.posWalletScan(MoneyText.format(_walletMinor)),
                ),
              ),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            Text(l10n.posWalletScan(MoneyText.format(_walletMinor)),
                textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium),
            const SizedBox(height: AppTokens.spacingSm),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              StatusChip(label: l10n.posConfirming, tone: StatusTone.warning),
              const SizedBox(width: AppTokens.spacingSm),
              Text(l10n.posWalletWaiting),
            ]),
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.text(
                label: l10n.posLeaveWaiting,
                onPressed: () => Navigator.of(context).pop(true)),
          ] else ...[
            if (_settings.cashEnabled && _settings.walletEnabled)
              SegmentedButton<bool>(
                segments: [
                  ButtonSegment(
                      value: false,
                      label: Text(l10n.posMethodCash),
                      icon: const Icon(Icons.payments_outlined)),
                  ButtonSegment(
                      value: true,
                      label: Text(l10n.posMethodWallet),
                      icon: const Icon(Icons.qr_code_2)),
                ],
                selected: {_useWallet},
                onSelectionChanged: (s) => setState(() {
                  _useWallet = s.first;
                  _cash.text = _useWallet ? '0.00' : '';
                  _error = null;
                }),
              ),
            const SizedBox(height: AppTokens.spacingMd),
            if (_useWallet && _settings.cashEnabled) ...[
              TextField(
                controller: _cash,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                    labelText: l10n.posMethodCash, prefixText: r'$ '),
              ),
              const SizedBox(height: AppTokens.spacingSm),
              Text('${l10n.posWalletAmount}: ${MoneyText.format(_walletMinor)}',
                  style: theme.textTheme.titleMedium),
              const SizedBox(height: AppTokens.spacingMd),
            ],
            if (_cashMinor > 0) ...[
              TextField(
                controller: _received,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: l10n.posReceived,
                  prefixText: r'$ ',
                  hintText: MoneyText.format(_cashMinor, symbol: ''),
                ),
              ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                    onPressed: () => setState(() => _received.clear()),
                    child: Text(l10n.posExact)),
              ),
              Semantics(
                liveRegion: true,
                child: Text(
                  _changeMinor >= 0
                      ? l10n.posChange(MoneyText.format(_changeMinor))
                      : l10n.posCashShort,
                  style: theme.textTheme.headlineSmall?.copyWith(
                      color: _changeMinor < 0 ? theme.colorScheme.error : null),
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: AppTokens.spacingMd),
              Semantics(
                  liveRegion: true,
                  child: Text(_error!,
                      style: TextStyle(color: theme.colorScheme.error))),
            ],
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(
                label: l10n.posFinish, loading: _sending, onPressed: _finish),
          ],
        ],
      ),
    );
  }
}
