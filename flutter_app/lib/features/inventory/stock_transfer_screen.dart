import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-INV-04 · `/inventory/transfer` · Transferencia entre bodegas.
class StockTransferScreen extends StatefulWidget {
  const StockTransferScreen({super.key, required this.api, this.productName});

  final ApiClient api;
  final String? productName;

  @override
  State<StockTransferScreen> createState() => _StockTransferScreenState();
}

class _StockTransferScreenState extends State<StockTransferScreen> {
  late final _productController = TextEditingController(text: widget.productName ?? 'Café Geisha Especial 250g');
  final _qtyController = TextEditingController();
  String _sourceWarehouse = 'central';
  String _targetWarehouse = 'calle50';

  @override
  void dispose() {
    _productController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_sourceWarehouse == _targetWarehouse || _qtyController.text.trim().isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Transferencia entre bodegas registrada.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isValid = _sourceWarehouse != _targetWarehouse && _qtyController.text.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(title: const Text('Transferir existencias')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PPTextField(
                controller: _productController,
                labelText: 'Producto / Variante',
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                initialValue: _sourceWarehouse,
                decoration: const InputDecoration(labelText: 'Bodega de origen'),
                items: const [
                  DropdownMenuItem(value: 'central', child: Text('Bodega Central (Disponible: 40 ud)')),
                  DropdownMenuItem(value: 'calle50', child: Text('Sucursal Calle 50 (Disponible: 12 ud)')),
                ],
                onChanged: (v) => setState(() => _sourceWarehouse = v ?? 'central'),
              ),
              const SizedBox(height: 12),
              const Center(child: Icon(Icons.arrow_downward)),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                initialValue: _targetWarehouse,
                decoration: const InputDecoration(labelText: 'Bodega de destino'),
                items: const [
                  DropdownMenuItem(value: 'central', child: Text('Bodega Central')),
                  DropdownMenuItem(value: 'calle50', child: Text('Sucursal Calle 50')),
                ],
                onChanged: (v) => setState(() => _targetWarehouse = v ?? 'calle50'),
              ),
              const SizedBox(height: 16),

              if (_sourceWarehouse == _targetWarehouse)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    'Las bodegas de origen y destino deben ser distintas.',
                    style: TextStyle(color: theme.colorScheme.error, fontSize: 13),
                  ),
                ),

              PPTextField(
                controller: _qtyController,
                labelText: 'Cantidad a transferir (unidades)',
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Confirmar transferencia',
                onPressed: isValid ? _submit : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
