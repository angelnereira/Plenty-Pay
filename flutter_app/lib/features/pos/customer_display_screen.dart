import 'package:flutter/material.dart';

import '../../core/widgets/money_text.dart';

/// S-POS-12 · `/display/:pairing` · Pantalla del cliente (display de cara al comprador).
///
/// Pantalla completa, tema oscuro de alta legibilidad, grilla en vivo y QR para pago.
class CustomerDisplayScreen extends StatelessWidget {
  const CustomerDisplayScreen({super.key, required this.pairingCode});

  final String pairingCode;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: ThemeData.dark(useMaterial3: true),
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                // Panel izquierdo: Líneas de la venta
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.storefront, color: Colors.white70),
                          const SizedBox(width: 8),
                          const Text('Mi Negocio POS', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                          const Spacer(),
                          Text('Caja emparejada ($pairingCode)', style: const TextStyle(color: Colors.white38, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 20),
                      const Divider(color: Colors.white24),
                      Expanded(
                        child: ListView(
                          children: const [
                            _DisplayLineTile(name: '1x Café Geisha Especial 250g', priceMinor: 1850),
                            _DisplayLineTile(name: '2x Croissant de Almendras', priceMinor: 850),
                            _DisplayLineTile(name: '1x Agua Mineral 500mL', priceMinor: 150),
                          ],
                        ),
                      ),
                      const Divider(color: Colors.white24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('Subtotal:', style: TextStyle(color: Colors.white70, fontSize: 16)),
                          MoneyText(2850, style: TextStyle(color: Colors.white, fontSize: 16)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('ITBMS (7%):', style: TextStyle(color: Colors.white70, fontSize: 16)),
                          MoneyText(199, style: TextStyle(color: Colors.white, fontSize: 16)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text('TOTAL:', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
                          MoneyText(3049, style: TextStyle(color: Colors.amber, fontSize: 36, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 24),
                const VerticalDivider(color: Colors.white24, width: 1),
                const SizedBox(width: 24),

                // Panel derecho: Código QR para pagar
                Expanded(
                  flex: 2,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('Paga con tu Billetera PlentyPay', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      const Text('Escanea este código con tu app móvil', style: TextStyle(color: Colors.white60, fontSize: 13), textAlign: TextAlign.center),
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.qr_code_2, size: 180, color: Colors.black),
                      ),
                      const SizedBox(height: 24),
                      TextButton.icon(
                        icon: const Icon(Icons.fullscreen_exit, color: Colors.white60),
                        label: const Text('Salir de pantalla del cliente', style: TextStyle(color: Colors.white60)),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DisplayLineTile extends StatelessWidget {
  const _DisplayLineTile({required this.name, required this.priceMinor});

  final String name;
  final int priceMinor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: const TextStyle(color: Colors.white, fontSize: 18)),
          MoneyText(priceMinor, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
