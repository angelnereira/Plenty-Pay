import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-POS-10 · `/pos/close` · Cierre y arqueo de caja (Reporte Z).
class PosCloseSessionScreen extends StatefulWidget {
  const PosCloseSessionScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PosCloseSessionScreen> createState() => _PosCloseSessionScreenState();
}

class _PosCloseSessionScreenState extends State<PosCloseSessionScreen> {
  final _cashCountedController = TextEditingController();
  final _notesController = TextEditingController();
  final int _expectedCashMinor = 14500; // $145.00

  int get _countedCashMinor {
    final parsed = double.tryParse(_cashCountedController.text) ?? 0.0;
    return (parsed * 100).round();
  }

  int get _differenceMinor => _countedCashMinor - _expectedCashMinor;

  @override
  void dispose() {
    _cashCountedController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _confirmClose() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sesión de caja cerrada. Reporte Z impreso.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasDiff = _cashCountedController.text.isNotEmpty && _differenceMinor != 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Cierre de caja (Reporte Z)')),
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
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Fondo inicial de caja:'),
                          MoneyText(5000),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Ventas en efectivo del turno:'),
                          MoneyText(9500),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Ventas con tarjeta:'),
                          MoneyText(18200),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Ventas con QR PlentyPay:'),
                          MoneyText(4500),
                        ],
                      ),
                      const Divider(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Efectivo esperado en caja:', style: TextStyle(fontWeight: FontWeight.bold)),
                          MoneyText(_expectedCashMinor, style: const TextStyle(fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text('Arqueo físico de efectivo', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),

              PPTextField(
                controller: _cashCountedController,
                labelText: 'Efectivo total contado en gaveta (B/.)',
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),

              if (_cashCountedController.text.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _differenceMinor == 0
                        ? Colors.green.withValues(alpha: 0.15)
                        : theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _differenceMinor == 0 ? 'Cuadre perfecto (sin diferencia)' : 'Diferencia de arqueo:',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      MoneyText(
                        _differenceMinor,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _differenceMinor == 0 ? Colors.green : theme.colorScheme.error,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),

              if (hasDiff)
                PPTextField(
                  controller: _notesController,
                  labelText: 'Justificación de diferencia (obligatoria si hay descuadre)',
                  onChanged: (_) => setState(() {}),
                ),

              const Spacer(),

              PPButton.primary(
                label: 'Confirmar cierre y emitir Reporte Z',
                onPressed: _cashCountedController.text.isNotEmpty &&
                        (!hasDiff || _notesController.text.trim().isNotEmpty)
                    ? _confirmClose
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
