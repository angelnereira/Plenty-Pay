import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../../core/widgets/status_chip.dart';

/// S-INV-09 · `/inventory/warehouses` · Gestión de bodegas y sucursales.
class WarehousesScreen extends StatefulWidget {
  const WarehousesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<WarehousesScreen> createState() => _WarehousesScreenState();
}

class _WarehousesScreenState extends State<WarehousesScreen> {
  final List<Map<String, dynamic>> _warehouses = [
    {
      'name': 'Bodega Central',
      'location': 'Parque Industrial Costa del Este',
      'skus': 120,
      'isDefault': true,
    },
    {
      'name': 'Sucursal Calle 50',
      'location': 'Calle 50, PH Plaza Magna, Planta Baja',
      'skus': 45,
      'isDefault': false,
    },
  ];

  void _showAddWarehouse() {
    final name = TextEditingController();
    final address = TextEditingController();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Nueva bodega', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            PPTextField(controller: name, labelText: 'Nombre de la bodega'),
            const SizedBox(height: 8),
            PPTextField(controller: address, labelText: 'Dirección física'),
            const SizedBox(height: 16),
            PPButton.primary(
              label: 'Guardar bodega',
              onPressed: () {
                if (name.text.trim().isNotEmpty) {
                  setState(() {
                    _warehouses.add({
                      'name': name.text.trim(),
                      'location': address.text.trim(),
                      'skus': 0,
                      'isDefault': false,
                    });
                  });
                  Navigator.pop(ctx);
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bodegas y sucursales'),
        actions: [
          IconButton(
            tooltip: 'Nueva bodega',
            icon: const Icon(Icons.add),
            onPressed: _showAddWarehouse,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _warehouses.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final w = _warehouses[i];
            final isDef = w['isDefault'] as bool;
            return Card(
              child: ListTile(
                leading: const Icon(Icons.warehouse_outlined),
                title: Row(
                  children: [
                    Text(w['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (isDef) ...[
                      const SizedBox(width: 8),
                      const StatusChip(label: 'Principal', tone: StatusTone.info),
                    ],
                  ],
                ),
                subtitle: Text('${w['location']}\n${w['skus']} productos con existencias'),
                isThreeLine: true,
                trailing: const Icon(Icons.chevron_right),
              ),
            );
          },
        ),
      ),
    );
  }
}
