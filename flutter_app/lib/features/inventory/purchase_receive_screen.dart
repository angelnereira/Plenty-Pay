import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-INV-06 · `/inventory/receive/:po` · Recepción de compra con escáner.
class PurchaseReceiveScreen extends StatefulWidget {
  const PurchaseReceiveScreen({super.key, required this.api, required this.orderId});

  final ApiClient api;
  final String orderId;

  @override
  State<PurchaseReceiveScreen> createState() => _PurchaseReceiveScreenState();
}

class _PurchaseReceiveScreenState extends State<PurchaseReceiveScreen> {
  final _receivedQty = TextEditingController(text: '30');
  final _lotNumber = TextEditingController(text: 'L-2026-11');
  final _expiryDate = TextEditingController(text: '28 feb 2027');

  @override
  void dispose() {
    _receivedQty.dispose();
    _lotNumber.dispose();
    _expiryDate.dispose();
    super.dispose();
  }

  void _confirm() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Mercancía ingresada al inventario y lotes actualizados.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Recibir ${widget.orderId}')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Producto solicitado:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      SizedBox(height: 4),
                      Text('Café Geisha Especial en Grano (Saco 25kg)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      SizedBox(height: 4),
                      Text('Cantidad pedida: 30 sacos · Proveedor: Finca Don Pachi'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Row(
                children: [
                  Expanded(
                    child: PPTextField(
                      controller: _receivedQty,
                      labelText: 'Cantidad recibida',
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filledTonal(
                    icon: const Icon(Icons.qr_code_scanner),
                    tooltip: 'Escanear código de barras de bulto',
                    onPressed: () {},
                  ),
                ],
              ),
              const SizedBox(height: 12),

              PPTextField(
                controller: _lotNumber,
                labelText: 'Número de lote del proveedor',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),

              PPTextField(
                controller: _expiryDate,
                labelText: 'Fecha de vencimiento (con mes en texto)',
                onChanged: (_) => setState(() {}),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Confirmar entrada a bodega',
                onPressed: _receivedQty.text.trim().isNotEmpty ? _confirm : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
