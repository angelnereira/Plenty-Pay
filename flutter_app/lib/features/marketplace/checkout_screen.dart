import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../wallet/pay_result_screen.dart';

/// S-MKT-05 · `/market/checkout` · Checkout multi-tienda.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.api,
    this.totalMinor = 2950,
  });

  final ApiClient api;
  final int totalMinor;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _fulfillment = 'delivery';
  String _paymentMethod = 'wallet';
  final _address = TextEditingController(text: 'Calle 50 y Aquilino de la Guardia, PH Tower, Piso 14');
  final _phone = TextEditingController(text: '+507 6123-4567');
  final _notes = TextEditingController();
  bool _processing = false;

  @override
  void dispose() {
    _address.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    setState(() => _processing = true);
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => PayResultScreen(api: widget.api),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.checkoutTitle)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(l10n.deliveryMethod, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'delivery', label: Text('Entrega a domicilio')),
                      ButtonSegment(value: 'pickup', label: Text('Retiro en tienda')),
                    ],
                    selected: {_fulfillment},
                    onSelectionChanged: (set) => setState(() => _fulfillment = set.first),
                  ),
                  const SizedBox(height: 16),

                  if (_fulfillment == 'delivery') ...[
                    PPTextField(
                      controller: _address,
                      labelText: 'Dirección de entrega',
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 12),
                    PPTextField(
                      controller: _phone,
                      labelText: 'Teléfono de contacto',
                      keyboardType: TextInputType.phone,
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 12),
                    PPTextField(
                      controller: _notes,
                      labelText: 'Instrucciones para el repartidor (opcional)',
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 24),
                  ],

                  Text(l10n.paymentMethod, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Card(
                    child: RadioListTile<String>(
                      title: const Text('Billetera PlentyPay'),
                      subtitle: const Text('Saldo disponible: B/.145.50'),
                      value: 'wallet',
                      groupValue: _paymentMethod,
                      onChanged: (v) => setState(() => _paymentMethod = v ?? 'wallet'),
                    ),
                  ),
                  Card(
                    child: RadioListTile<String>(
                      title: const Text('Yappy'),
                      subtitle: const Text('Riel instantáneo de Banco General'),
                      value: 'yappy',
                      groupValue: _paymentMethod,
                      onChanged: (v) => setState(() => _paymentMethod = v ?? 'yappy'),
                    ),
                  ),
                  const SizedBox(height: 24),

                  Text(l10n.orderSummary, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Card(
                    color: theme.colorScheme.surfaceContainerLow,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Café Geisha Especial (x1)'),
                              const MoneyText(1850),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Croissant de Almendras (x2)'),
                              const MoneyText(850),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Entrega a domicilio'),
                              const MoneyText(250),
                            ],
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(l10n.total, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                              MoneyText(
                                widget.totalMinor,
                                style: theme.textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: PPButton.primary(
                label: l10n.actionPlaceOrder,
                onPressed: _processing ? null : _placeOrder,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
