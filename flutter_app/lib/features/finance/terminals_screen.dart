import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-FIN-04 · `/finance/terminals` · Terminales de cobro QR y NFC.
///
/// Permiso: `payments:terminal:manage`.
/// Administra terminales de cobro físicas (QR de mostrador, tags NFC NTAG424, dispositivos POS vinculados).
class TerminalsScreen extends StatefulWidget {
  const TerminalsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<TerminalsScreen> createState() => _TerminalsScreenState();
}

class _TerminalsScreenState extends State<TerminalsScreen> {
  final List<Map<String, dynamic>> _terminals = [
    {
      'id': 'TERM-001',
      'name': 'Caja 1 - Mostrador Principal',
      'type': 'QR Estático + NFC Stand',
      'branch': 'Sucursal Marbella',
      'active': true,
      'last_seen': 'Hace 5 minutos',
      'tx_today': 34,
    },
    {
      'id': 'TERM-002',
      'name': 'Caja 2 - Entrada Rápida',
      'type': 'Tablet POS Android',
      'branch': 'Sucursal Marbella',
      'active': true,
      'last_seen': 'Hace 2 minutos',
      'tx_today': 21,
    },
    {
      'id': 'TERM-003',
      'name': 'Móvil Delivery 1',
      'type': 'Dispositivo Móvil Repartidor',
      'branch': 'Sucursal Marbella',
      'active': false,
      'last_seen': '18 de octubre de 2026',
      'tx_today': 0,
    },
  ];

  void _showAddTerminalDialog() {
    final nameCtrl = TextEditingController();
    String terminalType = 'qr_stand';

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
              Text('Registrar nueva terminal', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Nombre o identificador'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: terminalType,
                decoration: const InputDecoration(labelText: 'Tipo de terminal'),
                items: const [
                  DropdownMenuItem(value: 'qr_stand', child: Text('QR mostrador + NFC Sticker')),
                  DropdownMenuItem(value: 'pos_device', child: Text('Dispositivo POS Android emparejado')),
                  DropdownMenuItem(value: 'mobile_kiosk', child: Text('Quiosco de autoservicio')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => terminalType = val);
                },
              ),
              const SizedBox(height: 20),
              PPButton.primary(
                label: 'Crear terminal',
                onPressed: () {
                  if (nameCtrl.text.trim().isNotEmpty) {
                    setState(() {
                      _terminals.add({
                        'id': 'TERM-00${_terminals.length + 1}',
                        'name': nameCtrl.text.trim(),
                        'type': terminalType == 'qr_stand' ? 'QR Mostrador' : 'Dispositivo POS',
                        'branch': 'Sucursal Marbella',
                        'active': true,
                        'last_seen': 'Recién creada',
                        'tx_today': 0,
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
        title: const Text('Terminales QR y NFC'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _terminals.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final t = _terminals[index];
            final isActive = t['active'] as bool;

            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                side: BorderSide(color: theme.colorScheme.outlineVariant),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.contactless_outlined, color: theme.colorScheme.primary),
                            const SizedBox(width: 8),
                            Text(t['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                        StatusChip(
                          label: isActive ? 'Activa' : 'Inactiva',
                          tone: isActive ? StatusChipTone.success : StatusChipTone.neutral,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Tipo: ${t['type']}', style: theme.textTheme.bodyMedium),
                    Text('ID: ${t['id']} · ${t['branch']}', style: theme.textTheme.bodySmall),
                    Text('Transacciones hoy: ${t['tx_today']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        OutlinedButton.icon(
                          icon: const Icon(Icons.print_outlined, size: 16),
                          label: const Text('Imprimir QR'),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Generando PDF de QR de mostrador con logo...')),
                            );
                          },
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.nfc, size: 16),
                          label: const Text('Escribir NFC'),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Acerca el tag NFC NTAG424 para programar URL firmada')),
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Registrar nueva terminal',
            onPressed: _showAddTerminalDialog,
          ),
        ),
      ),
    );
  }
}
