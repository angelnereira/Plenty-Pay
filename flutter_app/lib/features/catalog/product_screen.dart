import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-CAT-02 · `/catalog/new`, `/catalog/:id` · Editor de producto.
///
/// `catalog:write` · Reglas: N-FIS-01, N-FIS-02, N-FIS-13, N-CON-02, N-CON-03,
/// N-CON-07, N-LOG-01, N-LOG-04, N-LOG-05, N-LOG-07, N-FMT-08, N-FMT-09.
/// Un solo botón filled ("Guardar"); "Archivar" es la acción secundaria.
class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.api, this.productId});

  final ApiClient api;
  final String? productId;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  final _sku = TextEditingController();
  final _barcode = TextEditingController();
  final _price = TextEditingController();
  final _cost = TextEditingController();
  final _minStock = TextEditingController();
  final _warrantyDays = TextEditingController();
  String _unit = 'ud';
  String _taxTreatment = 'gravado';
  String _taxRate = '7';
  bool _sellByWeight = false;
  bool _trackStock = true;
  bool _trackLot = false;
  bool _onlyAdults = false;
  bool _requiresPrescription = false;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _sku.dispose();
    _barcode.dispose();
    _price.dispose();
    _cost.dispose();
    _minStock.dispose();
    _warrantyDays.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.productId == null ? l10n.newProduct : l10n.editProduct),
        actions: [
          if (widget.productId != null)
            TextButton(
              onPressed: () {},
              child: Text(l10n.archiveProduct, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Básico
            _Section(title: l10n.sectionBasic),
            PPTextField(label: l10n.fieldProductName, controller: _name, hint: '2–120 caracteres'),
            const SizedBox(height: 12),
            PPTextField(label: l10n.fieldDescription, controller: _description, hint: '≤ 4 000 caracteres'),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: null,
              decoration: InputDecoration(labelText: l10n.fieldCategory),
              items: const [],
              onChanged: (_) {},
            ),
            const SizedBox(height: 16),
            // Identificación
            _Section(title: l10n.sectionIdentification),
            PPTextField(label: l10n.fieldSku, controller: _sku, hint: 'Se genera si se deja vacío'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: PPTextField(label: l10n.fieldBarcode, controller: _barcode)),
                const SizedBox(width: 8),
                IconButton(icon: const Icon(Icons.qr_code_scanner), onPressed: () {}),
              ],
            ),
            const SizedBox(height: 16),
            // Venta
            _Section(title: l10n.sectionSale),
            DropdownButtonFormField<String>(
              initialValue: _unit,
              decoration: InputDecoration(labelText: l10n.fieldUnit),
              items: const [
                DropdownMenuItem(value: 'ud', child: Text('Unidad (ud)')),
                DropdownMenuItem(value: 'kg', child: Text('kg')),
                DropdownMenuItem(value: 'g', child: Text('g')),
                DropdownMenuItem(value: 'L', child: Text('L')),
                DropdownMenuItem(value: 'mL', child: Text('mL')),
                DropdownMenuItem(value: 'm', child: Text('m')),
                DropdownMenuItem(value: 'cm', child: Text('cm')),
                DropdownMenuItem(value: 'm2', child: Text('m²')),
              ],
              onChanged: (v) => setState(() => _unit = v ?? 'ud'),
            ),
            const SizedBox(height: 8),
            SwitchListTile(
              title: Text(l10n.sellByWeight),
              value: _sellByWeight,
              onChanged: (v) => setState(() => _sellByWeight = v),
            ),
            PPTextField(label: l10n.fieldPrice, controller: _price, keyboardType: TextInputType.number),
            const SizedBox(height: 8),
            SwitchListTile(
              title: Text(l10n.priceIncludesTax),
              value: true,
              onChanged: (_) {},
            ),
            PPTextField(label: l10n.fieldCost, controller: _cost, keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            // Impuestos
            _Section(title: l10n.sectionTaxes),
            DropdownButtonFormField<String>(
              initialValue: _taxTreatment,
              decoration: InputDecoration(labelText: l10n.fieldTaxTreatment),
              items: const [
                DropdownMenuItem(value: 'gravado', child: Text('Gravado')),
                DropdownMenuItem(value: 'exento', child: Text('Exento')),
                DropdownMenuItem(value: 'no_sujeto', child: Text('No sujeto')),
              ],
              onChanged: (v) => setState(() => _taxTreatment = v ?? 'gravado'),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _taxRate,
              decoration: InputDecoration(labelText: l10n.fieldTaxRate),
              items: const [
                DropdownMenuItem(value: '7', child: Text('7 %')),
                DropdownMenuItem(value: '10', child: Text('10 %')),
                DropdownMenuItem(value: '15', child: Text('15 %')),
                DropdownMenuItem(value: '0', child: Text('0 %')),
              ],
              onChanged: (v) => setState(() => _taxRate = v ?? '7'),
            ),
            const SizedBox(height: 16),
            // Inventario
            _Section(title: l10n.sectionInventory),
            SwitchListTile(title: Text(l10n.trackStock), value: _trackStock, onChanged: (v) => setState(() => _trackStock = v)),
            SwitchListTile(title: Text(l10n.trackLot), value: _trackLot, onChanged: (v) => setState(() => _trackLot = v)),
            PPTextField(label: l10n.fieldMinStock, controller: _minStock, keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            // Restricciones
            _Section(title: l10n.sectionRestrictions),
            SwitchListTile(title: Text(l10n.onlyAdults), value: _onlyAdults, onChanged: (v) => setState(() => _onlyAdults = v)),
            SwitchListTile(title: Text(l10n.requiresPrescription), value: _requiresPrescription, onChanged: (v) => setState(() => _requiresPrescription = v)),
            const SizedBox(height: 16),
            // Garantía
            _Section(title: l10n.sectionWarranty),
            PPTextField(label: l10n.fieldWarrantyDays, controller: _warrantyDays, keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            // Panel de readiness
            DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.readinessTitle, style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text(l10n.readinessReadyToSell, style: Theme.of(context).textTheme.bodySmall),
                    Text(l10n.readinessReadyToPublish, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(label: l10n.actionSave, onPressed: () {}),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(title, style: Theme.of(context).textTheme.titleSmall),
    );
  }
}