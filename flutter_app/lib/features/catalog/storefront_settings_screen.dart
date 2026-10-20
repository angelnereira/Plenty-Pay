import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';
import '../marketplace/market_data.dart';
import 'catalog_data.dart';
import 'product_image.dart';

class _Loaded {
  const _Loaded(this.store, this.products, this.listed);
  final StorefrontInfo store;
  final List<ProductItem> products;
  final Set<String> listed;
}

/// S-CAT-05 · `/catalog/storefront` · Mi tienda en línea. `catalog:listing:manage` · N-CON-02 ·
/// `GET|PUT /v1/catalog/storefront`, `PUT /v1/catalog/products/{id}/listing`.
///
/// e1 "Tu tienda está visible/oculta" (solo un negocio ACTIVE puede mostrarla) · e2 nombre y
/// descripción · e4 retiro en tienda (la entrega a domicilio llega con logistics) · e6 interruptor
/// "Publicar" por producto; catalog rechaza con `LISTING_INCOMPLETE` lo que no tiene foto o precio ·
/// e7 "Guardar". Logo, horario y política de devoluciones (e2, e3, e5) llegan cuando catalog los
/// guarde. Lo publicado se lee de la propia búsqueda del marketplace filtrada a la tienda.
class StorefrontSettingsScreen extends StatefulWidget {
  const StorefrontSettingsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<StorefrontSettingsScreen> createState() =>
      _StorefrontSettingsScreenState();
}

class _StorefrontSettingsScreenState extends State<StorefrontSettingsScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  bool _published = false;
  bool _saving = false;
  final Set<String> _toggling = {};
  late Future<_Loaded> _future = _load();
  Set<String> _listed = {};

  Future<_Loaded> _load() async {
    StorefrontInfo store;
    try {
      store = StorefrontInfo.fromJson(await widget.api.myStorefront());
    } on ApiException catch (e) {
      if (e.status != 404) rethrow;
      // Sin vitrina todavía: se crea al guardar.
      store = const StorefrontInfo(
          tenantId: '',
          displayName: '',
          description: '',
          verified: false,
          published: false);
    }
    final products = (await loadProductIndex(widget.api)).values.toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    final listed = <String>{};
    if (store.tenantId.isNotEmpty && store.published) {
      var token = '';
      do {
        final body = await widget.api.marketplaceSearch(
            merchant: store.tenantId, pageSize: 100, pageToken: token);
        for (final r in (body['results'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>()) {
          listed.add(MarketProduct.fromJson(r).id);
        }
        token = (body['page'] as Map<String, dynamic>?)?['next_page_token']
                as String? ??
            '';
      } while (token.isNotEmpty);
    }
    _name.text = store.displayName;
    _description.text = store.description;
    _published = store.published;
    _listed = listed;
    return _Loaded(store, products, listed);
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    try {
      final saved = StorefrontInfo.fromJson(await widget.api.updateStorefront(
          displayName: _name.text.trim(),
          description: _description.text.trim(),
          published: _published,
          idempotencyKey: newRequestId()));
      if (!mounted) return;
      setState(() {
        _published = saved.published;
        _future = _load();
      });
      messenger.showSnackBar(SnackBar(content: Text(l10n.sfSaved)));
    } on Object catch (e) {
      widget.api.logger.breadcrumb('ui', 'catalog.storefront_save',
          e is ApiException ? e.reason : 'network');
      messenger
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _toggle(ProductItem p, bool listed) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _toggling.add(p.id));
    try {
      await widget.api
          .setListing(p.id, listed: listed, idempotencyKey: newRequestId());
      if (!mounted) return;
      setState(() => listed ? _listed.add(p.id) : _listed.remove(p.id));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.listing', e is ApiException ? e.reason : 'network');
      messenger
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _toggling.remove(p.id));
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.sfTitle)),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingSm),
          child: ListenableBuilder(
            listenable: _name,
            builder: (context, _) => PPButton.primary(
              label: l10n.actionSave,
              loading: _saving,
              onPressed: _name.text.trim().isEmpty ? null : _save,
            ),
          ),
        ),
      ),
      body: FutureBuilder<_Loaded>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingSm, margin, AppTokens.spacingXl),
          children: [
            AsyncView<_Loaded>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? marketErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, data) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: StatusChip(
                        label: _published ? l10n.sfVisible : l10n.sfHidden,
                        tone: _published
                            ? StatusTone.success
                            : StatusTone.neutral),
                  ),
                  const SizedBox(height: AppTokens.spacingMd),
                  PPTextField(controller: _name, label: l10n.sfName),
                  const SizedBox(height: AppTokens.spacingSm),
                  PPTextField(
                      controller: _description,
                      label: l10n.sfDescription,
                      maxLines: 4),
                  const SizedBox(height: AppTokens.spacingSm),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.sfPublishStore),
                    subtitle: Text(l10n.mktPickupFree),
                    value: _published,
                    onChanged: (v) => setState(() => _published = v),
                  ),
                  const SizedBox(height: AppTokens.spacingMd),
                  Text(l10n.sfProducts, style: theme.textTheme.titleMedium),
                  const SizedBox(height: AppTokens.spacingSm),
                  if (data.products.isEmpty)
                    Text(l10n.sfNoProducts, style: theme.textTheme.bodyLarge)
                  else
                    Card(
                      margin: EdgeInsets.zero,
                      elevation: 0,
                      color: theme.colorScheme.surfaceContainerLow,
                      child: Column(children: [
                        for (final p in data.products)
                          if (!p.archived)
                            SwitchListTile(
                              secondary:
                                  ProductThumb(api: widget.api, product: p),
                              title: Text(p.name),
                              subtitle: Text(l10n.sfPublish),
                              value: _listed.contains(p.id),
                              // Lo publicado solo se puede leer con la tienda visible y guardada.
                              onChanged: _toggling.contains(p.id) ||
                                      !data.store.published
                                  ? null
                                  : (v) => _toggle(p, v),
                            ),
                      ]),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
