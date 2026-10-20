import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import '../marketplace/market_data.dart';
import '../marketplace/market_widgets.dart' show formatQtyLabel, subTone;
import 'orders_manage_screen.dart' show deadlineTone;

/// Motivos de rechazo (S-ORD-02 e6). "No entrego en esa zona" llega con la entrega a domicilio.
const rejectReasons = ['OUT_OF_STOCK', 'STORE_CLOSED', 'OTHER'];

/// S-ORD-02 · `/orders/:id` · Detalle del sub-pedido. `orders:manage` ·
/// `POST /v1/merchant/sub-orders/{id}/{accept|ready|complete|reject}`.
///
/// e1 número, estado y cuenta regresiva · e2 retiro en tienda · e3 productos · e4 total · e5 la
/// acción del estado (Aceptar pedido → Marcar listo → Entregar al cliente) · e6 "Rechazar" con
/// motivo obligatorio y C-05 "Rechazar y reembolsar {monto}" · e7 código del cliente (6 dígitos).
/// Datos del cliente, existencias por línea, desglose de comisión y factura (e2–e4, e8) llegan con
/// sus servicios.
class OrderManageDetailScreen extends StatefulWidget {
  const OrderManageDetailScreen(
      {super.key, required this.api, required this.sub});
  final ApiClient api;
  final SubOrderItem sub;

  @override
  State<OrderManageDetailScreen> createState() =>
      _OrderManageDetailScreenState();
}

class _OrderManageDetailScreenState extends State<OrderManageDetailScreen> {
  late SubOrderItem _sub = widget.sub;
  final _code = TextEditingController();
  bool _busy = false;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    if (_sub.status == 'AWAITING_ACCEPTANCE') {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(Future<Map<String, dynamic>> Function() call) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final updated = SubOrderItem.fromJson(await call());
      if (!mounted) return;
      if (updated.status != 'AWAITING_ACCEPTANCE') _tick?.cancel();
      setState(() => _sub = updated);
      messenger.showSnackBar(SnackBar(content: Text(l10n.ordDone)));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'orders.action', e is ApiException ? e.reason : 'network');
      messenger
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _primary() {
    switch (_sub.status) {
      case 'AWAITING_ACCEPTANCE':
        _run(() => widget.api
            .subOrderAction(_sub.id, 'accept', idempotencyKey: newRequestId()));
      case 'ACCEPTED':
        _run(() => widget.api
            .subOrderAction(_sub.id, 'ready', idempotencyKey: newRequestId()));
      case 'READY':
        _run(() => widget.api.subOrderAction(_sub.id, 'complete',
            pickupCode: _code.text.trim(), idempotencyKey: newRequestId()));
    }
  }

  String _reasonLabel(AppLocalizations l10n, String r) => switch (r) {
        'OUT_OF_STOCK' => l10n.ordReason_STOCK,
        'STORE_CLOSED' => l10n.ordReason_CLOSED,
        _ => l10n.ordReason_OTHER,
      };

  Future<void> _reject() async {
    final l10n = AppLocalizations.of(context);
    var reason = '';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text(l10n.ordRejectReason),
          content: RadioGroup<String>(
            groupValue: reason,
            onChanged: (v) => setLocal(() => reason = v ?? ''),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              for (final r in rejectReasons)
                RadioListTile<String>(
                    value: r, title: Text(_reasonLabel(l10n, r))),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: Text(l10n.actionClose)),
            TextButton(
                onPressed:
                    reason.isEmpty ? null : () => Navigator.of(ctx).pop(true),
                child: Text(
                    l10n.ordRejectConfirm(MoneyText.format(_sub.totalMinor)))),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    await _run(() => widget.api.rejectSubOrder(_sub.id,
        reason: reason, idempotencyKey: newRequestId()));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final s = _sub;
    final left = s.deadline?.difference(DateTime.now());
    final primaryLabel = switch (s.status) {
      'AWAITING_ACCEPTANCE' => l10n.ordAccept,
      'ACCEPTED' => l10n.ordMarkReady,
      'READY' => l10n.ordHandOver,
      _ => null,
    };
    final canReject =
        s.status == 'AWAITING_ACCEPTANCE' || s.status == 'ACCEPTED';
    return Scaffold(
      appBar: AppBar(title: Text(l10n.mktOrderNumber(orderNumber(s.orderId)))),
      bottomNavigationBar: primaryLabel == null && !canReject
          ? null
          : SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                    margin, AppTokens.spacingSm, margin, AppTokens.spacingSm),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  if (primaryLabel != null)
                    ListenableBuilder(
                      listenable: _code,
                      builder: (context, _) => PPButton.primary(
                        label: primaryLabel,
                        loading: _busy,
                        onPressed:
                            s.status == 'READY' && _code.text.trim().length != 6
                                ? null
                                : _primary,
                      ),
                    ),
                  if (canReject) ...[
                    const SizedBox(height: AppTokens.spacingSm),
                    PPButton.secondary(
                        label: l10n.ordReject,
                        onPressed: _busy ? null : _reject),
                  ],
                ]),
              ),
            ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
        children: [
          Wrap(
              spacing: AppTokens.spacingSm,
              runSpacing: AppTokens.spacingXs,
              children: [
                StatusChip(
                    label: subStatusLabel(l10n, s.status),
                    tone: subTone(s.status)),
                if (s.status == 'AWAITING_ACCEPTANCE' && left != null)
                  StatusChip(label: countdown(left), tone: deadlineTone(left)),
              ]),
          const SizedBox(height: AppTokens.spacingMd),
          Card(
            margin: EdgeInsets.zero,
            elevation: 0,
            color: theme.colorScheme.surfaceContainerLow,
            child: Column(children: [
              ListTile(
                leading: const Icon(Icons.store_mall_directory_outlined),
                title: Text(l10n.ordPickupLabel),
              ),
              for (final l in s.lines)
                ListTile(
                  title: Text(l.name),
                  subtitle: Text(
                      '${formatQtyLabel(l.qtyMilli, 'UNIT')} · ${MoneyText.format(l.totalMinor)}'),
                ),
              ListTile(
                title:
                    Text(l10n.orderSummary, style: theme.textTheme.titleMedium),
                subtitle: MoneyText(s.totalMinor,
                    style: theme.textTheme.headlineSmall),
              ),
            ]),
          ),
          if (s.status == 'READY') ...[
            const SizedBox(height: AppTokens.spacingMd),
            TextField(
              key: const Key('pickup-code-field'),
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(labelText: l10n.ordCustomerCode),
            ),
          ],
          if (s.rejectionReason.isNotEmpty) ...[
            const SizedBox(height: AppTokens.spacingMd),
            Text(
                s.rejectionReason == 'ACCEPTANCE_TIMEOUT'
                    ? l10n.error_ACCEPT_DEADLINE_PASSED
                    : _reasonLabel(l10n, s.rejectionReason),
                style: theme.textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}
