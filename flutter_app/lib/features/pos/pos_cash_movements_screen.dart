import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-POS-09 · `/pos/cash` · Movimientos de caja (Entradas y Salidas de efectivo).
class PosCashMovementsScreen extends StatefulWidget {
  const PosCashMovementsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PosCashMovementsScreen> createState() => _PosCashMovementsScreenState();
}

class _PosCashMovementsScreenState extends State<PosCashMovementsScreen> {
  String _type = 'out'; // in, out
  final _amountController = TextEditingController();
  final _reasonController = TextEditingController();

  void _submit() {
    if (_amountController.text.trim().isEmpty || _reasonController.text.trim().isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Movimiento de caja registrado en el libro contable.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Movimientos de caja')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                color: theme.colorScheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Efectivo actual esperado en gaveta:'),
                      const MoneyText(12500, style: TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text('Tipo de movimiento', style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'out', label: Text('Salida / Retiro')),
                  ButtonSegment(value: 'in', label: Text('Entrada / Depósito')),
                ],
                selected: {_type},
                onSelectionChanged: (set) => setState(() => _type = set.first),
              ),
              const SizedBox(height: 16),

              PPTextField(
                controller: _amountController,
                labelText: 'Monto (B/.)',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),

              PPTextField(
                controller: _reasonController,
                labelText: 'Motivo del movimiento (ej. pago de hielo, cambio de sencillo)',
                onChanged: (_) => setState(() {}),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Registrar movimiento de efectivo',
                onPressed: _amountController.text.trim().isNotEmpty &&
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
