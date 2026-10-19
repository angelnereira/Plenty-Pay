import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'pos_receipt_screen.dart';

/// S-POS-03 · `/pos/sell/pay` · Cobro multi-pago (multi-tender).
class PosCheckoutScreen extends StatefulWidget {
  const PosCheckoutScreen({
    super.key,
    required this.api,
    required this.totalMinor,
  });

  final ApiClient api;
  final int totalMinor;

  @override
  State<PosCheckoutScreen> createState() => _PosCheckoutScreenState();
}

class _TenderEntry {
  _TenderEntry({required this.method, required this.amountMinor});
  final String method;
  final int amountMinor;
}

class _PosCheckoutScreenState extends State<PosCheckoutScreen> {
  String _selectedMethod = 'cash';
  final _cashReceivedController = TextEditingController();
  final List<_TenderEntry> _tenders = [];
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    _cashReceivedController.text = (widget.totalMinor / 100).toStringAsFixed(2);
  }

  @override
  void dispose() {
    _cashReceivedController.dispose();
    super.dispose();
  }

  int get _paidMinor => _tenders.fold(0, (sum, t) => sum + t.amountMinor);
  int get _remainingMinor => (widget.totalMinor - _paidMinor).clamp(0, widget.totalMinor);

  int get _cashReceivedMinor {
    final parsed = double.tryParse(_cashReceivedController.text) ?? 0.0;
    return (parsed * 100).round();
  }

  int get _changeDueMinor {
    if (_cashReceivedMinor > _remainingMinor) {
      return _cashReceivedMinor - _remainingMinor;
    }
    return 0;
  }

  void _addCashTender() {
    final amount = _cashReceivedMinor > _remainingMinor ? _remainingMinor : _cashReceivedMinor;
    if (amount <= 0) return;
    setState(() {
      _tenders.add(_TenderEntry(method: 'Efectivo', amountMinor: amount));
    });
  }

  void _addCardTender() {
    if (_remainingMinor <= 0) return;
    setState(() {
      _tenders.add(_TenderEntry(method: 'Tarjeta débito/crédito', amountMinor: _remainingMinor));
    });
  }

  void _addQrTender() {
    if (_remainingMinor <= 0) return;
    setState(() {
      _tenders.add(_TenderEntry(method: 'QR PlentyPay', amountMinor: _remainingMinor));
    });
  }

  Future<void> _completeSale() async {
    setState(() => _processing = true);
    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => PosReceiptScreen(
          api: widget.api,
          saleId: 'SALE-${DateTime.now().millisecondsSinceEpoch % 100000}',
          totalMinor: widget.totalMinor,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isFullyPaid = _remainingMinor == 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Cobrar venta')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Resumen de total y pendiente
              Card(
                color: theme.colorScheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Total de la venta', style: TextStyle(fontSize: 12)),
                          MoneyText(widget.totalMinor, style: theme.textTheme.titleMedium),
                        ],
                      ),
                      const Spacer(),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text('Por cobrar', style: TextStyle(fontSize: 12)),
                          MoneyText(
                            _remainingMinor,
                            style: theme.textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: isFullyPaid ? Colors.green : theme.colorScheme.error,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Medios de pago
              Text('Seleccionar medio de pago', style: theme.textTheme.titleSmall),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'cash', label: Text('Efectivo')),
                  ButtonSegment(value: 'card', label: Text('Tarjeta')),
                  ButtonSegment(value: 'qr', label: Text('QR')),
                ],
                selected: {_selectedMethod},
                onSelectionChanged: (set) => setState(() => _selectedMethod = set.first),
              ),
              const SizedBox(height: 16),

              if (_selectedMethod == 'cash') ...[
                TextField(
                  controller: _cashReceivedController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    labelText: 'Efectivo recibido (B/.)',
                    prefixText: 'B/. ',
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 8),
                if (_changeDueMinor > 0)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Vuelto / Cambio a entregar:', style: TextStyle(fontWeight: FontWeight.bold)),
                        MoneyText(_changeDueMinor, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.green)),
                      ],
                    ),
                  ),
                const SizedBox(height: 8),
                FilledButton.tonal(
                  onPressed: _remainingMinor > 0 ? _addCashTender : null,
                  child: const Text('Aplicar pago en efectivo'),
                ),
              ] else if (_selectedMethod == 'card') ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Terminal / Redirección de tarjeta (N-STD-28)', style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        const Text('PlentyPay nunca almacena datos de tarjeta.', style: TextStyle(fontSize: 12)),
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                          onPressed: _remainingMinor > 0 ? _addCardTender : null,
                          child: const Text('Autorizar tarjeta por terminal POS'),
                        ),
                      ],
                    ),
                  ),
                ),
              ] else ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        const Icon(Icons.qr_code, size: 48),
                        const SizedBox(height: 8),
                        const Text('Escanea el QR del cliente con la cámara'),
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                          onPressed: _remainingMinor > 0 ? _addQrTender : null,
                          child: const Text('Cobrar con QR PlentyPay'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 16),
              // Pagos registrados
              Text('Pagos aplicados', style: theme.textTheme.titleSmall),
              const SizedBox(height: 6),
              Expanded(
                child: _tenders.isEmpty
                    ? const Center(child: Text('Aún no has aplicado pagos.'))
                    : ListView.builder(
                        itemCount: _tenders.length,
                        itemBuilder: (context, i) => Card(
                          margin: const EdgeInsets.only(bottom: 6),
                          child: ListTile(
                            dense: true,
                            title: Text(_tenders[i].method),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                MoneyText(_tenders[i].amountMinor),
                                IconButton(
                                  icon: const Icon(Icons.close, size: 18),
                                  onPressed: () => setState(() => _tenders.removeAt(i)),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
              ),

              PPButton.primary(
                label: 'Completar venta y emitir recibo',
                onPressed: isFullyPaid && !_processing ? _completeSale : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
