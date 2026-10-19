import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-INV-03 · `/inventory/adjust` · Ajuste de existencias con motivo.
class StockAdjustScreen extends StatefulWidget {
  const StockAdjustScreen({super.key, required this.api, this.productName});

  final ApiClient api;
  final String? productName;

  @override
  State<StockAdjustScreen> createState() => _StockAdjustScreenState();
}

class _StockAdjustScreenState extends State<StockAdjustScreen> {
  late final _productController = TextEditingController(text: widget.productName ?? 'Café Geisha Especial 250g');
  final _qtyController = TextEditingController();
  final _reasonController = TextEditingController();
  String _warehouse = 'central';
  String _type = 'decrement'; // increment, decrement

  @override
  void dispose() {
    _productController.dispose();
    _qtyController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_qtyController.text.trim().isEmpty || _reasonController.text.trim().isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ajuste de inventario registrado en auditoría.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ajuste de inventario')),
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
                initialValue: _warehouse,
                decoration: const InputDecoration(labelText: 'Bodega de ajuste'),
                items: const [
                  DropdownMenuItem(value: 'central', child: Text('Bodega Central')),
                  DropdownMenuItem(value: 'calle50', child: Text('Sucursal Calle 50')),
                ],
                onChanged: (v) => setState(() => _warehouse = v ?? 'central'),
              ),
              const SizedBox(height: 16),

              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'decrement', label: Text('Merma / Salida (-)')),
                  ButtonSegment(value: 'increment', label: Text('Ingreso físico (+)')),
                ],
                selected: {_type},
                onSelectionChanged: (set) => setState(() => _type = set.first),
              ),
              const SizedBox(height: 16),

              PPTextField(
                controller: _qtyController,
                labelText: 'Cantidad (unidades)',
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),

              PPTextField(
                controller: _reasonController,
                labelText: 'Motivo del ajuste (obligatorio: rotura, vencimiento, inventario físico)',
                onChanged: (_) => setState(() {}),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Registrar ajuste de inventario',
                onPressed: _qtyController.text.trim().isNotEmpty &&
                        _reasonController.text.trim().isNotEmpty
                    ? _submit
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
