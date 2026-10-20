import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../marketplace/market_data.dart'
    show StorefrontInfo, marketErrorMessage;
import 'catalog_data.dart';

/// "Mostrar en el marketplace" de un producto guardado (S-CAT-02, S-CAT-05 e6, S-INV-02).
///
/// Lo cambia al instante con `PUT /v1/catalog/products/{id}/listing` (catalog R4); el estado
/// inicial es `listed_in_marketplace` del producto. Un rechazo (`LISTING_INCOMPLETE`,
/// `TENANT_NOT_ACTIVE`, permiso) deja el interruptor como estaba y muestra su motivo. Con la tienda
/// oculta avisa que el producto no se verá hasta mostrarla. [storeHidden] null = se consulta.
class ListingSwitch extends StatefulWidget {
  const ListingSwitch(
      {super.key,
      required this.api,
      required this.product,
      this.storeHidden,
      this.leading,
      this.title,
      this.onChanged});
  final ApiClient api;
  final ProductItem product;
  final bool? storeHidden;
  final Widget? leading;

  /// Sin título se usa "Mostrar en el marketplace".
  final String? title;
  final ValueChanged<bool>? onChanged;

  @override
  State<ListingSwitch> createState() => _ListingSwitchState();
}

class _ListingSwitchState extends State<ListingSwitch> {
  late bool _listed = widget.product.listed;
  bool _busy = false;
  bool? _storeHidden;

  @override
  void initState() {
    super.initState();
    _storeHidden = widget.storeHidden;
    if (_storeHidden == null) _loadStore();
  }

  @override
  void didUpdateWidget(ListingSwitch old) {
    super.didUpdateWidget(old);
    if (widget.storeHidden != null) _storeHidden = widget.storeHidden;
    if (old.product.listed != widget.product.listed) {
      _listed = widget.product.listed;
    }
  }

  Future<void> _loadStore() async {
    try {
      final s = StorefrontInfo.fromJson(await widget.api.myStorefront());
      if (mounted) setState(() => _storeHidden = !s.published);
    } on ApiException catch (e) {
      // Sin vitrina todavía (404): está oculta. Otro fallo: el aviso no se muestra.
      widget.api.logger.breadcrumb('ui', 'catalog.listing_store', e.reason);
      if (mounted && e.status == 404) setState(() => _storeHidden = true);
    }
  }

  Future<void> _set(bool listed) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await widget.api.setListing(widget.product.id,
          listed: listed, idempotencyKey: newRequestId());
      if (!mounted) return;
      setState(() => _listed = listed);
      widget.onChanged?.call(listed);
      messenger.showSnackBar(SnackBar(
          content: Text(listed ? l10n.mktListingOn : l10n.mktListingOff)));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.listing', e is ApiException ? e.reason : 'network');
      messenger
          .showSnackBar(SnackBar(content: Text(marketErrorMessage(l10n, e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SwitchListTile(
      key: Key('listing-${widget.product.id}'),
      contentPadding: EdgeInsets.zero,
      secondary: widget.leading,
      title: Text(widget.title ?? l10n.mktShowInMarketplace),
      subtitle: _listed && _storeHidden == true
          ? Text(l10n.mktStoreHiddenHint)
          : null,
      value: _listed,
      onChanged: _busy || widget.product.archived ? null : _set,
    );
  }
}
