import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../catalog/catalog_data.dart';
import 'purchasing_data.dart';

/// S-INV-06 · `/inventory/receive/:po` · Recepción. `inventory:receive`.
///
/// e1 «Orden {número} · {proveedor}», e2 por línea «Pedido · Recibido antes · Recibido ahora»
/// (propone lo pendiente; no se recibe más de lo pedido, `RECEIPT_EXCEEDS_ORDERED`), e4 factura del
/// proveedor opcional, e5 «Registrar recepción». Lotes y escáner llegan con F16.4.
class PurchaseReceiveScreen extends StatefulWidget {
  const PurchaseReceiveScreen(
      {super.key, required this.api, required this.order, required this.products});
  final ApiClient api;
  final PurchaseOrderItem order;
  final Map<String, ProductItem> products;

  @override
  State<PurchaseReceiveScreen> createState() => _PurchaseReceiveScreenState();
}

class _PurchaseReceiveScreenState extends State<PurchaseReceiveScreen> {
  late final Map<String, TextEditingController> _now = {
    for (final l in widget.order.lines)
      if (l.pendingMilli > 0)
        l.productId: TextEditingController(
            text: formatQty(l.pendingMilli, 'UNIT')),
  };
  final _invoice = TextEditingController();
  final String _key = newRequestId();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in _now.values) {
      c.dispose();
    }
    _invoice.dispose();
    super.dispose();
  }

  /// Cantidades a registrar; null si alguna no es válida o supera lo pendiente.
  List<Map<String, Object?>>? get _received {
    final out = <Map<String, Object?>>[];
    for (final l in widget.order.lines) {
      final c = _now[l.productId];
      if (c == null || c.text.trim().isEmpty) continue;
      final q = parseQtyMilli(c.text);
      if (q == null || q > l.pendingMilli) return null;
      if (q > 0) out.add({'product_id': l.productId, 'received_milli': '$q'});
    }
    return out;
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final lines = _received;
    if (lines == null || lines.isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final j = await widget.api.receivePurchaseOrder(widget.order.id, lines,
          supplierInvoice: _invoice.text.trim(), idempotencyKey: _key);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.poReceived)));
      Navigator.of(context).pop(PurchaseOrderItem.fromJson(j));
    } on Object catch (e) {
      if (mounted) setState(() => _error = purchasingErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final o = widget.order;
    final lines = _received;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.poReceiveTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
        children: [
          Semantics(
            header: true,
            child: Text(l10n.poNumber(o.shortId, o.supplierName),
                style: theme.textTheme.titleLarge),
          ),
          const SizedBox(height: AppTokens.spacingMd),
          for (final l in o.lines)
            Card(
              margin: const EdgeInsets.only(bottom: AppTokens.spacingSm),
              elevation: 0,
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.spacingMd),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                          widget.products[l.productId]?.name ??
                              l10n.invUnknownProduct,
                          style: theme.textTheme.titleMedium),
                      const SizedBox(height: AppTokens.spacingXs),
                      Text(l10n.poReceiveLine(
                        formatQty(l.orderedMilli, _unit(l.productId)),
                        formatQty(l.receivedMilli, _unit(l.productId)),
                      )),
                      if (_now[l.productId] case final c?) ...[
                        const SizedBox(height: AppTokens.spacingSm),
                        PPTextField(
                          controller: c,
                          labelText: l10n.poReceiveNow,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          onChanged: (_) => setState(() {}),
                          error: _lineError(l10n, l, c),
                        ),
                      ],
                    ]),
              ),
            ),
          const SizedBox(height: AppTokens.spacingSm),
          PPTextField(
            controller: _invoice,
            labelText: l10n.poSupplierInvoice,
            onChanged: (_) => setState(() {}),
            error: _invoice.text.trim().length > 60
                ? l10n.poSupplierInvoiceTooLong
                : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: AppTokens.spacingSm),
            Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
          ],
          const SizedBox(height: AppTokens.spacingLg),
          PPButton.primary(
            label: l10n.poReceiveSubmit,
            onPressed: _saving ||
                    lines == null ||
                    lines.isEmpty ||
                    _invoice.text.trim().length > 60
                ? null
                : _submit,
          ),
        ],
      ),
    );
  }

  String _unit(String productId) =>
      widget.products[productId]?.unitType ?? 'UNIT';

  String? _lineError(
      AppLocalizations l10n, PurchaseLineItem l, TextEditingController c) {
    if (c.text.trim().isEmpty) return null;
    final q = parseQtyMilli(c.text);
    if (q == null) return l10n.poInvalidQuantity;
    if (q > l.pendingMilli) return l10n.error_RECEIPT_EXCEEDS_ORDERED;
    return null;
  }
}
