import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/barcode_scanner_dialog.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-LOG-02 · `/logistics/:id` · Detalle de despacho y asignación de repartidor.
class DeliveryDetailScreen extends StatelessWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.api,
    required this.deliveryId,
  });

  final ApiClient api;
  final String deliveryId;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text('Entrega $deliveryId')),
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
                    children: [
                      Icon(Icons.local_shipping, size: 32, color: theme.colorScheme.primary),
                      const SizedBox(width: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Estado de la entrega', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 4),
                          const StatusChip(label: 'En camino al cliente', tone: StatusTone.info),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Datos del destinatario:', style: TextStyle(fontWeight: FontWeight.bold)),
                      SizedBox(height: 6),
                      Text('Cliente: María Fernández · Tel: +507 6890-1122'),
                      SizedBox(height: 4),
                      Text('Destino: Calle 74 San Francisco, Edificio Bahía, Apto 5B'),
                      SizedBox(height: 12),
                      Text('Repartidor asignado:', style: TextStyle(fontWeight: FontWeight.bold)),
                      SizedBox(height: 6),
                      Text('Carlos Vega (En turno) · Moto Yamaha YBR · Placa M-9821'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Prueba de entrega requerida (N-LOG-04):', style: TextStyle(fontWeight: FontWeight.bold)),
                      SizedBox(height: 6),
                      Text('• Código de 6 dígitos ingresado por el cliente'),
                      SizedBox(height: 4),
                      Text('• Fotografía del paquete recibido'),
                      SizedBox(height: 4),
                      Text('• Firma digital en pantalla'),
                    ],
                  ),
                ),
              ),
              const Spacer(),

              PPButton.primary(
                label: 'Escanear QR de Entrega (POD)',
                onPressed: () async {
                  final code = await BarcodeScannerDialog.scan(
                    context,
                    title: 'Escanear Entrega de Pedido',
                    subtitle: 'Apunta la cámara al código QR del cliente para confirmar la entrega',
                  );
                  if (!context.mounted) return;
                  if (code != null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('✓ Entrega verificada con éxito ($code)')),
                    );
                  }
                },
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                child: const Text('Reasignar repartidor'),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Buscando repartidor más cercano disponible...')),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
