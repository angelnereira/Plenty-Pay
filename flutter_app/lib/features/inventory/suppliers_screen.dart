import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-INV-07 · `/inventory/suppliers` · Proveedores.
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  final List<Map<String, String>> _suppliers = [
    {'name': 'Finca Don Pachi', 'ruc': '8-745-1234 DV 12', 'phone': '+507 720-1122', 'leadTime': '3 días'},
    {'name': 'Molino Santa Rosa', 'ruc': '155694-1-8942 DV 08', 'phone': '+507 260-3344', 'leadTime': '2 días'},
    {'name': 'Empaques del Istmo S.A.', 'ruc': '201948-2-7102 DV 41', 'phone': '+507 390-5566', 'leadTime': '5 días'},
  ];

  void _showAddSupplier() {
    final name = TextEditingController();
    final ruc = TextEditingController();
    final phone = TextEditingController();

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
            const Text('Nuevo proveedor', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            PPTextField(controller: name, labelText: 'Nombre o razón social'),
            const SizedBox(height: 8),
            PPTextField(controller: ruc, labelText: 'RUC con DV'),
            const SizedBox(height: 8),
            PPTextField(controller: phone, labelText: 'Teléfono de contacto'),
            const SizedBox(height: 16),
            PPButton.primary(
              label: 'Guardar proveedor',
              onPressed: () {
                if (name.text.trim().isNotEmpty) {
                  setState(() {
                    _suppliers.add({
                      'name': name.text.trim(),
                      'ruc': ruc.text.trim(),
                      'phone': phone.text.trim(),
                      'leadTime': '3 días',
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
        title: const Text('Proveedores'),
        actions: [
          IconButton(
            tooltip: 'Nuevo proveedor',
            icon: const Icon(Icons.add),
            onPressed: _showAddSupplier,
          ),
        ],
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: _suppliers.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final s = _suppliers[i];
            return Card(
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.business)),
                title: Text(s['name']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('RUC: ${s['ruc']} · Tel: ${s['phone']}'),
                trailing: Text('Entrega: ${s['leadTime']}'),
              ),
            );
          },
        ),
      ),
    );
  }
}
