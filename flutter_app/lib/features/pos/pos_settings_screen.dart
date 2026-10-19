import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import 'customer_display_screen.dart';

/// S-POS-11 · `/pos/settings` · Configuración del punto de venta.
class PosSettingsScreen extends StatefulWidget {
  const PosSettingsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PosSettingsScreen> createState() => _PosSettingsScreenState();
}

class _PosSettingsScreenState extends State<PosSettingsScreen> {
  bool _taxIncluded = true;
  bool _offlineEnabled = true;
  final _maxDiscount = TextEditingController(text: '15');
  final _printerAddress = TextEditingController(text: '192.168.1.150:9100');

  @override
  void dispose() {
    _maxDiscount.dispose();
    _printerAddress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Configuración POS')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Reglas de precios e impuestos', style: theme.textTheme.titleMedium),
            SwitchListTile(
              title: const Text('Precios incluyen ITBMS'),
              subtitle: const Text('Desglosa el impuesto automáticamente en el ticket fiscal.'),
              value: _taxIncluded,
              onChanged: (v) => setState(() => _taxIncluded = v),
            ),
            const Divider(),

            Text('Operación offline y sincronización', style: theme.textTheme.titleMedium),
            SwitchListTile(
              title: const Text('Habilitar ventas sin conexión'),
              subtitle: const Text('Guarda ventas en cola local cifrada si se cae internet.'),
              value: _offlineEnabled,
              onChanged: (v) => setState(() => _offlineEnabled = v),
            ),
            const Divider(),

            Text('Límites y seguridad', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            PPTextField(
              controller: _maxDiscount,
              labelText: 'Descuento máximo del cajero (%) sin PIN supervisor',
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),
            PPTextField(
              controller: _printerAddress,
              labelText: 'Dirección IP de impresora térmica (ESC/POS)',
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 24),

            // Pantalla del cliente
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: ListTile(
                leading: const Icon(Icons.tv_outlined),
                title: const Text('Pantalla del cliente'),
                subtitle: const Text('Abrir display interactivo para segundo monitor o tablet.'),
                trailing: const Icon(Icons.open_in_new),
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => const CustomerDisplayScreen(pairingCode: 'POS-8921'),
                )),
              ),
            ),
            const SizedBox(height: 24),

            PPButton.primary(
              label: 'Guardar configuración',
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Configuración del POS guardada.')),
                );
                Navigator.of(context).pop();
              },
            ),
          ],
        ),
      ),
    );
  }
}
