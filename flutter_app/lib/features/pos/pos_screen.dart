import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../catalog/catalog_data.dart';
import '../catalog/catalog_errors.dart';
import '../catalog/product_image.dart';
import '../finance/terminals_screen.dart' show TerminalItem;
import 'pos_cash_movements_screen.dart';
import 'pos_checkout_screen.dart';
import 'pos_close_session_screen.dart';
import 'pos_data.dart';
import 'pos_parked_screen.dart';
import 'pos_sales_history_screen.dart';

/// Estado de entrada a la caja: sesión abierta (o null) y los puntos de cobro del negocio.
class _PosEntry {
  const _PosEntry(this.session, this.terminals);
  final SessionItem? session;
  final List<TerminalItem> terminals;
}

/// Módulo `pos`. Sin sesión abierta muestra S-POS-01 (abrir caja); con sesión, S-POS-02 (venta).
class PosScreen extends StatefulWidget {
  const PosScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  late Future<_PosEntry> _future = _load();

  Future<_PosEntry> _load() async {
    final session = await loadCurrentSession(widget.api);
    final body = await widget.api.listTerminals();
    final terminals = [
      for (final t in (body['terminals'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>())
        TerminalItem.fromJson(t),
    ];
    return _PosEntry(session, terminals);
  }

  void _reload() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FutureBuilder<_PosEntry>(
      future: _future,
      builder: (context, snap) {
        if (snap.hasData) {
          final e = snap.data!;
          return e.session == null
              ? PosOpenView(
                  api: widget.api,
                  terminals: e.terminals.where((t) => t.active).toList(),
                  onOpened: _reload)
              : PosSellView(
                  api: widget.api,
                  session: e.session!,
                  terminals: e.terminals,
                  onClosed: _reload);
        }
        return Scaffold(
          appBar: AppBar(title: Text(l10n.posOpenTitle)),
          body: Padding(
            padding: EdgeInsets.all(WindowClass.of(context).horizontalMargin),
            child: AsyncView<_PosEntry>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? catalogErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: _reload,
              emptyView: const SizedBox.shrink(),
              builder: (_, __) => const SizedBox.shrink(),
            ),
          ),
        );
      },
    );
  }
}

/// S-POS-01 · `/pos` · Abrir caja. `pos:session:manage` · `POST /v1/pos/sessions`.
///
/// e1 caja = uno de los puntos de cobro activos del negocio (S-FIN-04): por él cobra la billetera.
/// e2 fondo inicial ≥ $0.00. e4 "Abrir caja"; `SESSION_ALREADY_OPEN` lo dice. El conteo por
/// denominación (e3) y el selector de sucursal llegan con F17.3b.
class PosOpenView extends StatefulWidget {
  const PosOpenView(
      {super.key,
      required this.api,
      required this.terminals,
      required this.onOpened});
  final ApiClient api;
  final List<TerminalItem> terminals;
  final VoidCallback onOpened;

  @override
  State<PosOpenView> createState() => _PosOpenViewState();
}

class _PosOpenViewState extends State<PosOpenView> {
  late String? _terminal =
      widget.terminals.isEmpty ? null : widget.terminals.first.code;
  final _float = TextEditingController(text: '0.00');
  final _key = newRequestId();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final l10n = AppLocalizations.of(context);
    final float = MoneyText.parse(_float.text);
    if (_terminal == null || float == null || float < 0) {
      setState(() => _error = l10n.posAmountError);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.openCashSession(
          terminalCode: _terminal!,
          openingFloatMinor: float,
          idempotencyKey: _key);
      widget.onOpened();
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.open', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.posOpenTitle)),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
        children: [
          if (widget.terminals.isEmpty)
            Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: AppTokens.spacingXl),
              child: Text(l10n.posNoTerminals,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge),
            )
          else ...[
            DropdownButtonFormField<String>(
              initialValue: _terminal,
              isExpanded: true,
              decoration: InputDecoration(
                  labelText: l10n.posTerminal,
                  helperText: l10n.posTerminalHelper,
                  helperMaxLines: 2),
              items: [
                for (final t in widget.terminals)
                  DropdownMenuItem(value: t.code, child: Text(t.label))
              ],
              onChanged: (v) => setState(() => _terminal = v),
            ),
            const SizedBox(height: AppTokens.spacingMd),
            TextField(
              controller: _float,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                  labelText: l10n.posOpeningFloat, prefixText: r'$ '),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppTokens.spacingMd),
              Semantics(
                  liveRegion: true,
                  child: Text(_error!,
                      style: TextStyle(color: theme.colorScheme.error))),
            ],
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(
                label: l10n.posOpen, loading: _saving, onPressed: _open),
          ],
        ],
      ),
    );
  }
}

/// S-POS-02 · `/pos/sell` · Venta. `pos:sell`.
///
/// e1 buscador y escáner (código exacto agrega 1), e3 lista de productos con precio, e5 líneas con
/// cantidad ±, e8 totales con una fila de ITBMS por tasa y Exento, e9 "Cobrar {total}", e10 "Vaciar".
/// En ≥ expanded, dos paneles (catálogo | ticket). Cliente, descuentos, descuento de ley, entrega a
/// domicilio, estacionar y modo sin conexión llegan con F17.4b–F17.7 (no se muestran).
class PosSellView extends StatefulWidget {
  const PosSellView(
      {super.key,
      required this.api,
      required this.session,
      required this.terminals,
      required this.onClosed});
  final ApiClient api;
  final SessionItem session;
  final List<TerminalItem> terminals;
  final VoidCallback onClosed;

  @override
  State<PosSellView> createState() => _PosSellViewState();
}

class _PosSellViewState extends State<PosSellView> {
  late final Future<Map<String, ProductItem>> _products =
      loadProductIndex(widget.api);
  final _search = TextEditingController();
  final List<TicketLine> _lines = [];
  bool _charging = false;

  /// Una venta por ticket: el reintento usa el mismo `client_sale_id` y no crea otra (R7).
  String _clientSaleId = newRequestId();

  /// Venta del servidor de este ticket cuando ya existe (retomada de S-POS-06): se cobra esa
  /// misma, nunca una nueva (F17.4).
  String? _saleId;
  bool _parking = false;

  void _resetTicket() {
    _lines.clear();
    _clientSaleId = newRequestId();
    _saleId = null;
  }

  /// Guarda el ticket en el servidor: crea la venta si aún no existe y reemplaza sus líneas (el
  /// precio lo pone el servidor desde el catálogo).
  Future<SaleItem> _saveSale() async {
    final id = _saleId ??
        SaleItem.fromJson(await widget.api.createSale(widget.session.id,
                clientSaleId: _clientSaleId,
                idempotencyKey: 'create-$_clientSaleId'))
            .id;
    _saleId = id;
    return SaleItem.fromJson(await widget.api.updateSale(
        id,
        [
          for (final l in _lines)
            (productId: l.product.id, qtyMilli: l.qtyMilli)
        ],
        idempotencyKey: newRequestId()));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String get _terminalLabel {
    final t =
        widget.terminals.where((t) => t.code == widget.session.terminalCode);
    return t.isEmpty ? widget.session.terminalCode : t.first.label;
  }

  void _add(ProductItem p) {
    setState(() {
      final existing = _lines.where((l) => l.product.id == p.id);
      if (existing.isNotEmpty) {
        existing.first.qtyMilli += 1000;
      } else {
        _lines.add(TicketLine(p, 1000));
      }
    });
  }

  Future<void> _addBulk(ProductItem p) async {
    final l10n = AppLocalizations.of(context);
    final ctrl = TextEditingController();
    final qty = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.posQtyTitle(p.name)),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
              labelText: l10n.invQuantity,
              suffixText:
                  formatQty(1000, p.unitType).replaceFirst('1', '').trim()),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l10n.actionCancel)),
          TextButton(
              onPressed: () => Navigator.pop(ctx, parseQtyMilli(ctrl.text)),
              child: Text(l10n.actionSave)),
        ],
      ),
    );
    ctrl.dispose();
    if (qty == null || qty <= 0 || !mounted) return;
    setState(() => _lines.add(TicketLine(p, qty)));
  }

  void _tap(ProductItem p) => p.isBulk ? _addBulk(p) : _add(p);

  Future<void> _scan(Map<String, ProductItem> products) async {
    final l10n = AppLocalizations.of(context);
    final code = await BarcodeScannerDialog.scan(context,
        title: l10n.scanBarcode, subtitle: l10n.posSearchHint);
    if (code == null || !mounted) return;
    _addByCode(products, code.trim());
  }

  void _addByCode(Map<String, ProductItem> products, String code) {
    final l10n = AppLocalizations.of(context);
    final match =
        products.values.where((p) => p.barcode == code || p.sku == code);
    if (match.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posNotFound)));
      return;
    }
    _tap(match.first);
    _search.clear();
    setState(() {});
  }

  Future<void> _clear() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.posClearConfirm),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.actionCancel)),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l10n.posClear)),
        ],
      ),
    );
    if (ok == true) setState(_resetTicket);
  }

  /// S-POS-02 e10 «Estacionar» (F17.4): nota opcional, guarda la venta y deja el ticket vacío.
  Future<void> _park() async {
    final l10n = AppLocalizations.of(context);
    final label = await PosTextPrompt.show(context,
        title: l10n.posParkTitle,
        label: l10n.posParkLabel,
        confirm: l10n.posPark,
        maxLength: 60);
    if (label == null || !mounted) return;
    setState(() => _parking = true);
    try {
      final sale = await _saveSale();
      await widget.api.parkSale(sale.id, label: label);
      if (!mounted) return;
      setState(_resetTicket);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.posParked)));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.park', e is ApiException ? e.reason : 'network');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(catalogErrorMessage(l10n, e))));
      }
    } finally {
      if (mounted) setState(() => _parking = false);
    }
  }

  /// S-POS-06: al retomar, el ticket se arma con las líneas guardadas; un producto que ya no se
  /// vende se quita y se avisa.
  Future<void> _openParked() async {
    final l10n = AppLocalizations.of(context);
    final resumed = await Navigator.of(context).push<SaleItem>(
        MaterialPageRoute(
            builder: (_) => PosParkedScreen(
                api: widget.api,
                sessionId: widget.session.id,
                canResume: _lines.isEmpty)));
    if (resumed == null || !mounted) return;
    final products = await _products;
    if (!mounted) return;
    var missing = 0;
    setState(() {
      _resetTicket();
      _saleId = resumed.id;
      for (final l in resumed.lines) {
        final p = products[l.productId];
        if (p == null) {
          missing++;
        } else {
          _lines.add(TicketLine(p, l.qtyMilli));
        }
      }
    });
    if (missing > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.posParkedRemoved(missing))));
    }
  }

  Future<void> _charge() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _charging = true);
    try {
      final sale = await _saveSale();
      if (!mounted) return;
      final done = await Navigator.of(context).push<bool>(MaterialPageRoute(
          builder: (_) => PosCheckoutScreen(
              api: widget.api, sale: sale, terminalLabel: _terminalLabel)));
      if (done == true && mounted) setState(_resetTicket);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'pos.charge', e is ApiException ? e.reason : 'network');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(catalogErrorMessage(l10n, e))));
      }
    } finally {
      if (mounted) setState(() => _charging = false);
    }
  }

  Future<void> _menu(String action) async {
    if (action == 'parked') return _openParked();
    final screen = switch (action) {
      'sales' => PosSalesHistoryScreen(api: widget.api, session: widget.session)
          as Widget,
      'cash' =>
        PosCashMovementsScreen(api: widget.api, sessionId: widget.session.id),
      _ => PosCloseSessionScreen(api: widget.api, sessionId: widget.session.id),
    };
    final closed = await Navigator.of(context)
        .push<bool>(MaterialPageRoute(builder: (_) => screen));
    if (action == 'close' && closed == true) widget.onClosed();
  }

  Widget _catalogPanel(
      BuildContext context, Map<String, ProductItem> products) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final q = _search.text.trim().toLowerCase();
    final shown = products.values
        .where((p) =>
            q.isEmpty ||
            p.name.toLowerCase().contains(q) ||
            p.sku.toLowerCase().contains(q) ||
            p.barcode == q)
        .toList()
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(
        controller: _search,
        textInputAction: TextInputAction.done,
        onChanged: (_) => setState(() {}),
        onSubmitted: (code) => _addByCode(products, code.trim()),
        decoration: InputDecoration(
          prefixIcon: const Icon(Icons.search),
          hintText: l10n.posSearchHint,
          suffixIcon: IconButton(
              tooltip: l10n.scanBarcode,
              icon: const Icon(Icons.qr_code_scanner),
              onPressed: () => _scan(products)),
        ),
      ),
      const SizedBox(height: AppTokens.spacingSm),
      Expanded(
        child: products.isEmpty
            ? Center(
                child: Text(l10n.posProductsEmpty, textAlign: TextAlign.center))
            : ListView.builder(
                itemCount: shown.length,
                itemBuilder: (context, i) {
                  final p = shown[i];
                  return ListTile(
                    leading: ProductThumb(api: widget.api, product: p),
                    title: Text(p.name),
                    trailing: MoneyText(p.priceMinor,
                        style: theme.textTheme.titleMedium),
                    onTap: () => _tap(p),
                  );
                },
              ),
      ),
    ]);
  }

  Widget _chargeButton(BuildContext context, TicketTotals totals) =>
      PPButton.primary(
        label: AppLocalizations.of(context)
            .posCharge(MoneyText.format(totals.totalMinor)),
        loading: _charging,
        onPressed: _lines.isEmpty ? null : _charge,
      );

  Widget _ticketPanel(BuildContext context, {bool withCharge = true}) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final totals = TicketTotals.of(_lines);
    Widget row(String label, int minor, {bool strong = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(children: [
            Expanded(
                child: Text(label,
                    style: strong
                        ? theme.textTheme.titleLarge
                        : theme.textTheme.bodyMedium)),
            MoneyText(minor,
                style: strong
                    ? theme.textTheme.titleLarge
                    : theme.textTheme.bodyMedium),
          ]),
        );
    final rates = totals.taxByRate.keys.toList()..sort();
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: theme.colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Wrap(
                  spacing: AppTokens.spacingSm,
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Semantics(
                        header: true,
                        child: Text(l10n.posTicket,
                            style: theme.textTheme.titleMedium)),
                    Text(l10n.posCustomerFinal,
                        style: theme.textTheme.labelLarge),
                  ]),
              const SizedBox(height: AppTokens.spacingSm),
              if (_lines.isEmpty)
                Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: AppTokens.spacingMd),
                  child: Text(l10n.posTicketEmpty, textAlign: TextAlign.center),
                )
              else
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 260),
                  child: ListView(shrinkWrap: true, children: [
                    for (final l in _lines)
                      Dismissible(
                        key: ObjectKey(l),
                        direction: DismissDirection.endToStart,
                        onDismissed: (_) => setState(() => _lines.remove(l)),
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(l.product.name),
                          subtitle: Wrap(
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                    '${formatQty(l.qtyMilli, l.product.unitType)} × ${MoneyText.format(l.product.priceMinor)}'),
                                if (!l.product.isBulk) ...[
                                  IconButton(
                                    tooltip: l10n.posDecrease,
                                    icon:
                                        const Icon(Icons.remove_circle_outline),
                                    onPressed: () => setState(() {
                                      if (l.qtyMilli > 1000) {
                                        l.qtyMilli -= 1000;
                                      } else {
                                        _lines.remove(l);
                                      }
                                    }),
                                  ),
                                  IconButton(
                                    tooltip: l10n.posIncrease,
                                    icon: const Icon(Icons.add_circle_outline),
                                    onPressed: () =>
                                        setState(() => l.qtyMilli += 1000),
                                  ),
                                ] else
                                  IconButton(
                                    tooltip: l10n.posRemoveLine(l.product.name),
                                    icon: const Icon(Icons.delete_outline),
                                    onPressed: () =>
                                        setState(() => _lines.remove(l)),
                                  ),
                              ]),
                          trailing: MoneyText(l.totalMinor),
                        ),
                      ),
                  ]),
                ),
              const Divider(),
              row(l10n.posSubtotal, totals.subtotalMinor),
              for (final r in rates)
                row(l10n.posTaxLine(percentOf(r)), totals.taxByRate[r]!),
              if (totals.exemptMinor > 0)
                row(l10n.posExempt, totals.exemptMinor),
              row(l10n.posTotal, totals.totalMinor, strong: true),
              const SizedBox(height: AppTokens.spacingMd),
              if (withCharge) _chargeButton(context, totals),
              if (_lines.isNotEmpty) ...[
                PPButton.text(
                    label: l10n.posPark,
                    onPressed: _parking || _charging ? null : _park),
                PPButton.text(label: l10n.posClear, onPressed: _clear),
              ],
            ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final wc = WindowClass.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_terminalLabel),
        actions: [
          PopupMenuButton<String>(
            onSelected: _menu,
            itemBuilder: (_) => [
              PopupMenuItem(value: 'parked', child: Text(l10n.posMenuParked)),
              PopupMenuItem(value: 'sales', child: Text(l10n.posMenuSales)),
              PopupMenuItem(value: 'cash', child: Text(l10n.posMenuCash)),
              PopupMenuItem(value: 'close', child: Text(l10n.posMenuClose)),
            ],
          ),
        ],
      ),
      body: FutureBuilder<Map<String, ProductItem>>(
        future: _products,
        builder: (context, snap) {
          if (!snap.hasData) {
            return Padding(
              padding: EdgeInsets.all(wc.horizontalMargin),
              child: AsyncView<Map<String, ProductItem>>(
                snapshot: snap,
                errorMessage: snap.hasError
                    ? catalogErrorMessage(l10n, snap.error!)
                    : l10n.errorNoConnection,
                retryLabel: l10n.actionRetry,
                onRetry: widget.onClosed,
                emptyView: const SizedBox.shrink(),
                builder: (_, __) => const SizedBox.shrink(),
              ),
            );
          }
          final products = snap.data!;
          final pad = EdgeInsets.fromLTRB(wc.horizontalMargin,
              AppTokens.spacingSm, wc.horizontalMargin, AppTokens.spacingMd);
          if (wc.twoPanes) {
            return Padding(
              padding: pad,
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(flex: 3, child: _catalogPanel(context, products)),
                const SizedBox(width: AppTokens.spacingMd),
                Expanded(
                    flex: 2,
                    child: SingleChildScrollView(child: _ticketPanel(context))),
              ]),
            );
          }
          // Compact: el ticket se desplaza y "Cobrar" queda fijo abajo, siempre visible.
          return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Padding(
                    padding: pad,
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                              flex: 3, child: _catalogPanel(context, products)),
                          const SizedBox(height: AppTokens.spacingSm),
                          Expanded(
                              flex: 2,
                              child: SingleChildScrollView(
                                  child: _ticketPanel(context,
                                      withCharge: false))),
                        ]),
                  ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(wc.horizontalMargin, 0,
                        wc.horizontalMargin, AppTokens.spacingMd),
                    child: _chargeButton(context, TicketTotals.of(_lines)),
                  ),
                ),
              ]);
        },
      ),
    );
  }
}
