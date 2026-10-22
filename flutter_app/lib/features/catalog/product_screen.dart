import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'catalog_data.dart';
import 'catalog_errors.dart';
import 'listing_switch.dart';
import 'product_image.dart';

/// S-CAT-02 · `/catalog/new`, `/catalog/:id` · Editor de producto. `catalog:write`.
///
/// Secciones con servicio hoy: Básico (nombre, descripción, categoría, fotos), Identificación
/// (SKU generado si se deja vacío, GTIN con dígito de control, código interno N-STD-24/26),
/// Venta (unidad, precio con ITBMS incluido), Impuestos (Gravado/Exento y la tasa vigente que da
/// el servidor, N-FIS-01) e Inventario (controlar existencias). Variantes, precios por sucursal,
/// lotes, garantía, restricciones y ofertas llegan con F15.1b–F15.5 y F16.4.
class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.api, this.product});
  final ApiClient api;

  /// null = producto nuevo.
  final ProductItem? product;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

const _units = ['UNIT', 'KG', 'LITER', 'METER'];
const _maxPhotos = 8;

class _ProductScreenState extends State<ProductScreen> {
  late final _name = TextEditingController(text: widget.product?.name ?? '');
  late final _description =
      TextEditingController(text: widget.product?.description ?? '');
  late final _sku = TextEditingController(text: widget.product?.sku ?? '');
  late final _barcode =
      TextEditingController(text: widget.product?.barcode ?? '');
  late final _price = TextEditingController(
      text: widget.product == null
          ? ''
          : MoneyText.format(widget.product!.priceMinor, symbol: ''));
  late String _unit = widget.product?.unitType ?? 'UNIT';
  late String _categoryId = widget.product?.categoryId ?? '';
  late bool _exempt = widget.product?.taxExempt ?? false;
  late int _rateBps = widget.product?.taxRateBps ?? 0;
  late bool _track = widget.product?.tracksInventory ?? true;
  late bool _lots = widget.product?.tracksLots ?? false;
  late final List<String> _photos = [...?widget.product?.imageUrls];

  late final Future<(List<CategoryItem>, List<TaxRateItem>)> _refs =
      _loadRefs();
  String _key = newRequestId();
  bool _saving = false;
  bool _uploading = false;
  bool _submitted = false;
  String? _error;

  bool get _isNew => widget.product == null;

  Future<(List<CategoryItem>, List<TaxRateItem>)> _loadRefs() async {
    final cats = await loadCategories(widget.api);
    final rates = await loadTaxRates(widget.api);
    // Producto nuevo y gravado: la tasa general vigente es la sugerida (S-CAT-02).
    if (_isNew && _rateBps == 0 && !_exempt) {
      final standard = rates.where((r) => r.kind == 'STANDARD');
      if (standard.isNotEmpty && mounted) {
        setState(() => _rateBps = standard.first.rateBps);
      }
    }
    return (cats, rates);
  }

  @override
  void dispose() {
    for (final c in [_name, _description, _sku, _barcode, _price]) {
      c.dispose();
    }
    super.dispose();
  }

  String? get _nameError {
    final n = _name.text.trim().length;
    return n < 2 || n > 120 ? AppLocalizations.of(context).catNameError : null;
  }

  int? get _priceMinor => MoneyText.parse(_price.text);

  String? get _priceError {
    final p = _priceMinor;
    return p == null || p <= 0
        ? AppLocalizations.of(context).catPriceError
        : null;
  }

  String? get _barcodeError {
    final b = _barcode.text.trim();
    return b.isNotEmpty && !validGtin(b)
        ? AppLocalizations.of(context).catBarcodeInvalid
        : null;
  }

  /// "Listo para vender": lo que falta, en el orden de la ficha.
  List<String> _missing(AppLocalizations l10n) => [
        if (_nameError != null) l10n.catName,
        if (_priceError != null) l10n.catPrice,
        if (_barcodeError != null) l10n.catBarcode,
        if (!_exempt && _rateBps == 0) l10n.catTaxRate,
      ];

  /// S-CAT-02 Fotos: "Tomar foto" o "Elegir de la galería"; sin cámara, directo a la galería.
  Future<ImageSource?> _chooseSource(ImagePicker picker) async {
    if (!picker.supportsImageSource(ImageSource.camera)) return ImageSource.gallery;
    final l10n = AppLocalizations.of(context);
    return showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: Text(l10n.catTakePhoto),
            onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(l10n.catChooseFromGallery),
            onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
          ),
        ]),
      ),
    );
  }

  Future<void> _pickPhoto() async {
    final l10n = AppLocalizations.of(context);
    final picker = ImagePicker();
    final source = await _chooseSource(picker);
    if (source == null || !mounted) return;
    final photo = await picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85);
    if (photo == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final bytes = await photo.readAsBytes();
      final url = await widget.api.uploadMedia(
          bytes: bytes,
          filename: photo.name.isEmpty ? 'producto.jpg' : photo.name,
          mimeType: photo.mimeType ?? 'image/jpeg');
      if (mounted) setState(() => _photos.add(url));
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.photo', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _scanBarcode() async {
    final l10n = AppLocalizations.of(context);
    final code = await BarcodeScannerDialog.scan(context,
        logger: widget.api.logger,
        title: l10n.scanBarcode, subtitle: l10n.catBarcode);
    if (code != null && mounted) setState(() => _barcode.text = code.trim());
  }

  Map<String, Object?> _body() {
    final seed = DateTime.now().microsecondsSinceEpoch;
    final sku = _sku.text.trim().isEmpty
        ? generateSku(_name.text, seed)
        : _sku.text.trim();
    return {
      'sku': sku,
      'barcode': _barcode.text.trim(),
      'name': _name.text.trim(),
      'description': _description.text.trim(),
      'category_id': _categoryId,
      'unit_type': _unit,
      'price': {'amount_minor': '${_priceMinor ?? 0}', 'currency': 'USD'},
      'tax_rate_bps': _exempt ? 0 : _rateBps,
      'tax_exempt': _exempt,
      'tracks_inventory': _track,
      'tracks_lots': _track && _lots,
      'image_object_keys': _photos,
      if (!_isNew) 'version': widget.product!.version,
    };
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    setState(() => _submitted = true);
    if (_missing(l10n).isNotEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      if (_isNew) {
        await widget.api.createProduct(_body(), idempotencyKey: _key);
      } else {
        await widget.api.updateProduct(
            widget.product!.id,
            _body(),
            const [
              'sku',
              'barcode',
              'name',
              'description',
              'category_id',
              'price',
              'tax_rate_bps',
              'tracks_inventory',
              'tracks_lots',
              'image_object_keys',
            ],
            idempotencyKey: _key);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.catSaved)));
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.save', e is ApiException ? e.reason : 'network');
      // El servidor respondió: el reintento lleva otro contenido y necesita otra clave.
      if (e is ApiException) _key = newRequestId();
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _archive() async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.catArchiveConfirmTitle(widget.product!.name)),
        content: Text(l10n.catArchiveConfirmBody),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l10n.actionCancel)),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l10n.catArchive)),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _saving = true);
    try {
      await widget.api
          .archiveProduct(widget.product!.id, idempotencyKey: newRequestId());
      if (mounted) Navigator.of(context).pop(true);
    } on Object catch (e) {
      widget.api.logger.breadcrumb(
          'ui', 'catalog.archive', e is ApiException ? e.reason : 'network');
      if (mounted) setState(() => _error = catalogErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _section(BuildContext context, String title, List<Widget> children) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTokens.spacingMd),
      child: Card(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: theme.colorScheme.surfaceContainerLow,
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Semantics(
                header: true,
                child: Text(title, style: theme.textTheme.titleMedium)),
            const SizedBox(height: AppTokens.spacingSm),
            ...children,
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final barcode = _barcode.text.trim();
    final missing = _missing(l10n);
    const gap = SizedBox(height: AppTokens.spacingSm);
    return Scaffold(
      appBar:
          AppBar(title: Text(_isNew ? l10n.catNewProduct : l10n.catEditTitle)),
      body: FutureBuilder<(List<CategoryItem>, List<TaxRateItem>)>(
        future: _refs,
        builder: (context, snap) {
          final cats = snap.data?.$1 ?? const <CategoryItem>[];
          final rates = snap.data?.$2 ?? const <TaxRateItem>[];
          return ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
            children: [
              _section(context, l10n.catSectionBasic, [
                TextField(
                  controller: _name,
                  maxLength: 120,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                      labelText: l10n.catName,
                      errorText: _submitted ? _nameError : null),
                ),
                gap,
                TextField(
                  controller: _description,
                  maxLength: 4000,
                  minLines: 2,
                  maxLines: 5,
                  decoration: InputDecoration(labelText: l10n.catDescription),
                ),
                gap,
                DropdownButtonFormField<String>(
                  initialValue:
                      cats.any((c) => c.id == _categoryId) ? _categoryId : '',
                  isExpanded: true,
                  decoration: InputDecoration(labelText: l10n.catCategory),
                  items: [
                    DropdownMenuItem(
                        value: '', child: Text(l10n.catNoCategory)),
                    for (final c in cats)
                      DropdownMenuItem(value: c.id, child: Text(c.name)),
                  ],
                  onChanged: (v) => setState(() => _categoryId = v ?? ''),
                ),
                gap,
                Text(l10n.catPhotos, style: theme.textTheme.labelLarge),
                gap,
                Wrap(
                    spacing: AppTokens.spacingSm,
                    runSpacing: AppTokens.spacingSm,
                    children: [
                      for (final (i, p) in _photos.indexed)
                        Stack(children: [
                          ClipRRect(
                            borderRadius:
                                BorderRadius.circular(AppTokens.radiusSm),
                            child: Image.network(mediaUrl(widget.api, p),
                                width: 72,
                                height: 72,
                                fit: BoxFit.cover,
                                semanticLabel: '${l10n.catPhotos} ${i + 1}',
                                errorBuilder: (_, __, ___) =>
                                    const SizedBox(width: 72, height: 72)),
                          ),
                          Positioned(
                            right: 0,
                            top: 0,
                            child: IconButton.filledTonal(
                              visualDensity: VisualDensity.compact,
                              tooltip: l10n.catRemovePhoto,
                              icon: const Icon(Icons.close, size: 16),
                              onPressed: () =>
                                  setState(() => _photos.removeAt(i)),
                            ),
                          ),
                        ]),
                      if (_photos.length < _maxPhotos)
                        OutlinedButton.icon(
                          onPressed: _uploading ? null : _pickPhoto,
                          icon: _uploading
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.add_a_photo_outlined),
                          label: Text(l10n.catAddPhoto),
                        ),
                    ]),
              ]),
              _section(context, l10n.catSectionId, [
                TextField(
                  controller: _sku,
                  maxLength: 64,
                  decoration: InputDecoration(
                      labelText: l10n.catSkuLabel,
                      helperText: l10n.catSkuHelper),
                ),
                gap,
                TextField(
                  controller: _barcode,
                  keyboardType: TextInputType.number,
                  maxLength: 14,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: l10n.catBarcode,
                    errorText: _barcodeError,
                    helperText: barcode.isNotEmpty &&
                            _barcodeError == null &&
                            isInternalCode(barcode)
                        ? l10n.catBarcodeInternal
                        : null,
                    helperMaxLines: 3,
                    suffixIcon: IconButton(
                      tooltip: l10n.scanBarcode,
                      icon: const Icon(Icons.qr_code_scanner),
                      onPressed: _scanBarcode,
                    ),
                  ),
                ),
                if (barcode.isEmpty)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton(
                      onPressed: () => setState(() => _barcode.text =
                          generateInternalCode(
                              DateTime.now().microsecondsSinceEpoch)),
                      child: Text(l10n.catGenerateInternal),
                    ),
                  ),
              ]),
              _section(context, l10n.catSectionSale, [
                DropdownButtonFormField<String>(
                  initialValue: _unit,
                  isExpanded: true,
                  decoration: InputDecoration(
                      labelText: l10n.catUnit,
                      helperText: _isNew ? null : l10n.catUnitLocked,
                      helperMaxLines: 2),
                  items: [
                    for (final u in _units)
                      DropdownMenuItem(
                          value: u,
                          child: Text(switch (u) {
                            'KG' => l10n.unit_KG,
                            'LITER' => l10n.unit_LITER,
                            'METER' => l10n.unit_METER,
                            _ => l10n.unit_UNIT,
                          })),
                  ],
                  onChanged: _isNew
                      ? (v) => setState(() => _unit = v ?? 'UNIT')
                      : null,
                ),
                gap,
                TextField(
                  controller: _price,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: l10n.catPrice,
                    prefixText: r'$ ',
                    errorText: _submitted ? _priceError : null,
                    helperText: l10n.catPriceIncludesTax,
                  ),
                ),
              ]),
              _section(context, l10n.catSectionTax, [
                Text(l10n.catTaxTreatment, style: theme.textTheme.labelLarge),
                gap,
                SegmentedButton<bool>(
                  segments: [
                    ButtonSegment(value: false, label: Text(l10n.catTaxed)),
                    ButtonSegment(value: true, label: Text(l10n.catExempt)),
                  ],
                  selected: {_exempt},
                  onSelectionChanged: (s) => setState(() => _exempt = s.first),
                ),
                if (!_exempt) ...[
                  gap,
                  if (snap.hasError)
                    Text(l10n.catTaxRatesUnavailable,
                        style: TextStyle(color: theme.colorScheme.error))
                  else
                    DropdownButtonFormField<int>(
                      initialValue: rates.any((r) => r.rateBps == _rateBps)
                          ? _rateBps
                          : null,
                      isExpanded: true,
                      decoration: InputDecoration(
                          labelText: l10n.catTaxRate,
                          errorText: _submitted && _rateBps == 0
                              ? l10n.error_TAX_TREATMENT_MISSING
                              : null),
                      items: [
                        for (final r in rates)
                          DropdownMenuItem(
                            value: r.rateBps,
                            child: Text(l10n.catTaxRateOption(
                                switch (r.kind) {
                                  'ALCOHOL' => l10n.taxKind_ALCOHOL,
                                  'TOBACCO' => l10n.taxKind_TOBACCO,
                                  _ => l10n.taxKind_STANDARD,
                                },
                                percentOf(r.rateBps))),
                          ),
                      ],
                      onChanged: (v) => setState(() => _rateBps = v ?? 0),
                    ),
                ],
              ]),
              _section(context, l10n.catSectionInventory, [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.catTrackStock),
                  value: _track,
                  onChanged: (v) => setState(() => _track = v),
                ),
                if (_track)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.catTrackLots),
                    subtitle: Text(l10n.catTrackLotsHint),
                    value: _lots,
                    onChanged: (v) => setState(() => _lots = v),
                  ),
              ]),
              if (!_isNew)
                _section(context, l10n.moduleMarketplace, [
                  ListingSwitch(api: widget.api, product: widget.product!),
                ]),
              Semantics(
                liveRegion: true,
                child: Row(children: [
                  Icon(
                      missing.isEmpty
                          ? Icons.check_circle_outline
                          : Icons.info_outline,
                      color: missing.isEmpty
                          ? theme.colorScheme.primary
                          : theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: AppTokens.spacingSm),
                  Expanded(
                    child: Text(
                        missing.isEmpty
                            ? l10n.catReadyToSell
                            : l10n.catMissingToSell(missing.join(', ')),
                        style: theme.textTheme.bodyMedium),
                  ),
                ]),
              ),
              if (_error != null) ...[
                const SizedBox(height: AppTokens.spacingMd),
                Semantics(
                  liveRegion: true,
                  child: Text(_error!,
                      style: TextStyle(color: theme.colorScheme.error)),
                ),
              ],
              const SizedBox(height: AppTokens.spacingLg),
              PPButton.primary(
                  label: l10n.actionSave, loading: _saving, onPressed: _save),
              if (!_isNew && !widget.product!.archived) ...[
                const SizedBox(height: AppTokens.spacingSm),
                PPButton.text(
                    label: l10n.catArchive,
                    onPressed: _saving ? null : _archive),
              ],
            ],
          );
        },
      ),
    );
  }
}
