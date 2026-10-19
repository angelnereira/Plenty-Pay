import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../auth/step_up_dialog.dart';

/// S-POS-08 · `/pos/sales/:id/refund` · Devolución por líneas (Nota de Crédito).
class PosRefundScreen extends StatefulWidget {
  const PosRefundScreen({
    super.key,
    required this.api,
    required this.saleId,
    required this.totalMinor,
  });

  final ApiClient api;
  final String saleId;
  final int totalMinor;

  @override
  State<PosRefundScreen> createState() => _PosRefundScreenState();
}

class _PosRefundScreenState extends State<PosRefundScreen> {
  final _reasonController = TextEditingController();
  bool _item1Selected = true;
  bool _item2Selected = false;
  bool _processing = false;

  int get _refundAmountMinor {
    int sum = 0;
    if (_item1Selected) sum += 1850;
    if (_item2Selected) sum += 600;
    return sum;
  }

  Future<void> _processRefund() async {
    if (_refundAmountMinor <= 0 || _reasonController.text.trim().isEmpty) return;

    // Acción protegida: confirmación fuerte de supervisor (🔒)
    final authorized = await StepUpDialog.confirm(
      context,
      title: 'Autorizar nota de crédito POS',
      amountMinor: _refundAmountMinor,
      description: 'Se generará una nota de crédito fiscal DGI vinculada a la venta ${widget.saleId}.',
    );
    if (!authorized) return;

    setState(() => _processing = true);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Nota de crédito emitida por B/.${(_refundAmountMinor / 100).toStringAsFixed(2)}.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text('Devolución ${widget.saleId}')),
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
                      const Text('Total original de venta:'),
                      MoneyText(widget.totalMinor, style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text('Selecciona las líneas a devolver', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),

              CheckboxListTile(
                value: _item1Selected,
                title: const Text('1x Café Geisha 250g'),
                secondary: const MoneyText(1850),
                onChanged: (v) => setState(() => _item1Selected = v ?? false),
              ),
              CheckboxListTile(
                value: _item2Selected,
                title: const Text('1x Botella Cold Brew'),
                secondary: const MoneyText(600),
                onChanged: (v) => setState(() => _item2Selected = v ?? false),
              ),
              const SizedBox(height: 16),

              PPTextField(
                controller: _reasonController,
                labelText: 'Motivo de la devolución (obligatorio)',
                onChanged: (_) => setState(() {}),
              ),
              const Spacer(),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Total a reembolsar:', style: theme.textTheme.titleMedium),
                  MoneyText(
                    _refundAmountMinor,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: theme.colorScheme.error,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              PPButton.primary(
                label: 'Emitir nota de crédito',
                onPressed: _refundAmountMinor > 0 &&
                        _reasonController.text.trim().isNotEmpty &&
                        !_processing
                    ? _processRefund
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
