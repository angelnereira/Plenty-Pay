import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-FIN-09 · `/finance/taxpayers` · Directorio de contribuyentes y receptores electrónicos frecuentes DGI.
///
/// Permiso: `fiscal:issue`.
/// Gestión de clientes con RUC y DV guardados para emisión ágil de factura electrónica.
class TaxpayersScreen extends StatefulWidget {
  const TaxpayersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<TaxpayersScreen> createState() => _TaxpayersScreenState();
}

class _TaxpayersScreenState extends State<TaxpayersScreen> {
  final List<Map<String, dynamic>> _taxpayers = [
    {
      'ruc': '155689123-2-2022',
      'dv': '42',
      'name': 'CONSTRUCTORA DEL ISTMO S.A.',
      'email': 'contabilidad@constructoraistmo.pa',
      'phone': '+507 269-8000',
      'invoices_count': 14,
    },
    {
      'ruc': '8-745-1289',
      'dv': '18',
      'name': 'CARLOS ALBERTO GONZÁLEZ MENDOZA',
      'email': 'carlos.gonzalez@gmail.com',
      'phone': '+507 6612-4589',
      'invoices_count': 6,
    },
    {
      'ruc': '2456789-1-812345',
      'dv': '90',
      'name': 'SERVICIOS LOGÍSTICOS DE PANAMÁ CORP.',
      'email': 'facturacion@slp.com.pa',
      'phone': '+507 300-4500',
      'invoices_count': 28,
    },
  ];

  void _showAddTaxpayerDialog() {
    final rucCtrl = TextEditingController();
    final dvCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
      ),
      builder: (ctx) => Padding(
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
            Text('Nuevo receptor fiscal DGI', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: rucCtrl,
                    decoration: const InputDecoration(labelText: 'RUC / Cédula'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 1,
                  child: TextField(
                    controller: dvCtrl,
                    decoration: const InputDecoration(labelText: 'DV'),
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Razón Social o Nombre legal'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(labelText: 'Correo electrónico para facturas'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              decoration: const InputDecoration(labelText: 'Teléfono de contacto'),
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 20),
            PPButton.primary(
              label: 'Guardar receptor',
              onPressed: () {
                if (rucCtrl.text.trim().isNotEmpty && nameCtrl.text.trim().isNotEmpty) {
                  setState(() {
                    _taxpayers.add({
                      'ruc': rucCtrl.text.trim(),
                      'dv': dvCtrl.text.trim().isEmpty ? '00' : dvCtrl.text.trim(),
                      'name': nameCtrl.text.trim().toUpperCase(),
                      'email': emailCtrl.text.trim(),
                      'phone': phoneCtrl.text.trim(),
                      'invoices_count': 0,
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
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Receptores electrónicos DGI'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _taxpayers.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final t = _taxpayers[index];
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
                        Expanded(
                          child: Text(
                            t['name'] as String,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.secondaryContainer,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'RUC: ${t['ruc']} DV ${t['dv']}',
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: theme.colorScheme.onSecondaryContainer,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Correo: ${t['email']}', style: theme.textTheme.bodyMedium),
                    Text('Teléfono: ${t['phone']}', style: theme.textTheme.bodySmall),
                    const Divider(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${t['invoices_count']} facturas emitidas', style: theme.textTheme.labelSmall),
                        TextButton(
                          child: const Text('Editar datos'),
                          onPressed: () {},
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
            label: 'Agregar nuevo receptor',
            onPressed: _showAddTaxpayerDialog,
          ),
        ),
      ),
    );
  }
}
