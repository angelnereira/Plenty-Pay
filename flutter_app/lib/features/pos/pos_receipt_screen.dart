import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../wallet/receipt.dart';

/// S-POS-05 · `/pos/receipt/:id` · Recibo y comprobante de venta POS.
class PosReceiptScreen extends StatefulWidget {
  const PosReceiptScreen({
    super.key,
    required this.api,
    required this.saleId,
    required this.totalMinor,
  });

  final ApiClient api;
  final String saleId;
  final int totalMinor;

  @override
  State<PosReceiptScreen> createState() => _PosReceiptScreenState();
}

class _PosReceiptScreenState extends State<PosReceiptScreen> {
  String _docType = 'electronic_invoice';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Venta completada'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      Icon(Icons.check_circle, size: 48, color: theme.colorScheme.primary),
                      const SizedBox(height: 8),
                      Text('¡Cobro exitoso!', style: theme.textTheme.headlineSmall),
                      const SizedBox(height: 4),
                      Text('Operación: ${widget.saleId}', style: theme.textTheme.bodySmall),
                      const SizedBox(height: 16),

                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'electronic_invoice', label: Text('Factura electrónica DGI')),
                          ButtonSegment(value: 'internal_ticket', label: Text('Recibo interno')),
                        ],
                        selected: {_docType},
                        onSelectionChanged: (set) => setState(() => _docType = set.first),
                      ),
                      const SizedBox(height: 16),

                      // Vista previa de recibo 80mm
                      ReceiptView(
                        data: ReceiptData(
                          merchantName: 'Mi Negocio POS',
                          merchantTaxId: '155689432-2-2022',
                          paidAt: DateTime.now(),
                          operationCode: widget.saleId,
                          paymentMethodLabel: 'Efectivo / Tarjeta',
                          currencySymbol: r'$',
                          lines: [
                            ReceiptLine(label: 'Venta en mostrador', minor: widget.totalMinor),
                          ],
                          totalMinor: widget.totalMinor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.print),
                      label: const Text('Imprimir (80mm)'),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Enviando comando de impresión ESC/POS...')),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.send),
                      label: const Text('Enviar digital'),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Recibo digital enviado al cliente.')),
                        );
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              PPButton.primary(
                label: 'Nueva venta',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
