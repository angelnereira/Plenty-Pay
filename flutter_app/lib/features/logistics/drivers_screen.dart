import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-LOG-03 · `/logistics/drivers` · Gestión de repartidores y transportistas.
///
/// Permiso: `logistics:manage`.
/// Muestra flota propia y tercerizada, licencia, placa, póliza y estado laboral.
class DriversScreen extends StatefulWidget {
  const DriversScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<DriversScreen> createState() => _DriversScreenState();
}

class _DriversScreenState extends State<DriversScreen> {
  final List<Map<String, dynamic>> _drivers = [
    {
      'id': 'drv_01',
      'name': 'Carlos Rodríguez',
      'phone': '+507 6890-1234',
      'vehicle': 'Moto Yamaha FZ (Placa: M-4521)',
      'license_exp': '15 de noviembre de 2027',
      'type': 'Empleado directo',
      'status': StatusChipTone.success,
      'status_label': 'Activo',
      'active_deliveries': 1,
    },
    {
      'id': 'drv_02',
      'name': 'José Pérez',
      'phone': '+507 6543-9876',
      'vehicle': 'Sedán Toyota Yaris (Placa: 894321)',
      'license_exp': '20 de enero de 2028',
      'type': 'Transportista tercerizado',
      'status': StatusChipTone.success,
      'status_label': 'Activo',
      'active_deliveries': 0,
    },
    {
      'id': 'drv_03',
      'name': 'Manuel Ramos',
      'phone': '+507 6712-3456',
      'vehicle': 'Panel Hyundai H1 (Placa: C-1289)',
      'license_exp': '05 de marzo de 2026',
      'type': 'Empleado directo',
      'status': StatusChipTone.neutral,
      'status_label': 'Inactivo',
      'active_deliveries': 0,
    },
  ];

  void _showAddDriverDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final vehicleCtrl = TextEditingController();
    final licenseCtrl = TextEditingController();
    String contractType = 'direct';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Registrar conductor', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Nombre completo'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneCtrl,
                decoration: const InputDecoration(labelText: 'Teléfono E.164 (+507 ...)'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: vehicleCtrl,
                decoration: const InputDecoration(labelText: 'Vehículo y número de placa'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: licenseCtrl,
                decoration: const InputDecoration(labelText: 'Número de licencia'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: contractType,
                decoration: const InputDecoration(labelText: 'Vínculo laboral (N-LAB)'),
                items: const [
                  DropdownMenuItem(value: 'direct', child: Text('Empleado directo')),
                  DropdownMenuItem(value: 'contractor', child: Text('Transportista tercerizado')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => contractType = val);
                },
              ),
              const SizedBox(height: 20),
              PPButton.primary(
                label: 'Guardar conductor',
                onPressed: () {
                  if (nameCtrl.text.trim().isNotEmpty) {
                    setState(() {
                      _drivers.add({
                        'id': 'drv_${DateTime.now().millisecondsSinceEpoch}',
                        'name': nameCtrl.text.trim(),
                        'phone': phoneCtrl.text.trim(),
                        'vehicle': vehicleCtrl.text.trim(),
                        'license_exp': '31 de diciembre de 2028',
                        'type': contractType == 'direct' ? 'Empleado directo' : 'Transportista tercerizado',
                        'status': StatusChipTone.success,
                        'status_label': 'Activo',
                        'active_deliveries': 0,
                      });
                    });
                    Navigator.pop(ctx);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Conductores y flota'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _drivers.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final drv = _drivers[index];
            return Container(
              padding: const EdgeInsets.all(AppTokens.spacingMd),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                border: Border.all(color: theme.colorScheme.outlineVariant),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.person_pin_circle_outlined, color: theme.colorScheme.primary),
                          const SizedBox(width: 8),
                          Text(
                            drv['name'] as String,
                            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      StatusChip(
                        label: drv['status_label'] as String,
                        tone: drv['status'] as StatusChipTone,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Teléfono: ${drv['phone']}', style: theme.textTheme.bodyMedium),
                  Text('Vehículo: ${drv['vehicle']}', style: theme.textTheme.bodyMedium),
                  Text('Vence licencia: ${drv['license_exp']}', style: theme.textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        drv['type'] as String,
                        style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.secondary),
                      ),
                      Text(
                        '${drv['active_deliveries']} entregas en curso',
                        style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Registrar nuevo conductor',
            onPressed: _showAddDriverDialog,
          ),
        ),
      ),
    );
  }
}
