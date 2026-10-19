import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-ANA-08 · `/insights/exports` · Centro de exportación de datos del negocio.
///
/// Permiso: `analytics:export`.
/// Permite generar y descargar exportes en CSV y XLSX de ventas, inventario, nómina y comprobantes DGI.
class ExportsScreen extends StatefulWidget {
  const ExportsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<ExportsScreen> createState() => _ExportsScreenState();
}

class _ExportsScreenState extends State<ExportsScreen> {
  String _entity = 'sales';
  String _format = 'csv';

  final List<Map<String, dynamic>> _history = [
    {
      'id': 'EXP-2026-089',
      'name': 'ventas_pos_octubre_2026.csv',
      'size': '2.4 MB',
      'date': '19 de octubre de 2026, 08:30 AM',
      'status': StatusChipTone.success,
      'status_label': 'Listo',
    },
    {
      'id': 'EXP-2026-088',
      'name': 'inventario_consolidado_bodegas.xlsx',
      'size': '1.1 MB',
      'date': '18 de octubre de 2026, 06:15 PM',
      'status': StatusChipTone.success,
      'status_label': 'Listo',
    },
    {
      'id': 'EXP-2026-087',
      'name': 'facturas_electronicas_dgi_sep.zip',
      'size': '8.7 MB',
      'date': '01 de octubre de 2026, 09:00 AM',
      'status': StatusChipTone.success,
      'status_label': 'Listo',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Exportación de datos'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                elevation: 0,
                color: theme.colorScheme.surfaceContainerLow,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                  side: BorderSide(color: theme.colorScheme.outlineVariant),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Configurar nueva exportación', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        value: _entity,
                        decoration: const InputDecoration(labelText: 'Entidad de datos a exportar'),
                        items: const [
                          DropdownMenuItem(value: 'sales', child: Text('Ventas completadas (POS & Marketplace)')),
                          DropdownMenuItem(value: 'cash', child: Text('Movimientos y arqueos de caja')),
                          DropdownMenuItem(value: 'inventory', child: Text('Existencias y lotes de inventario')),
                          DropdownMenuItem(value: 'payroll', child: Text('Planillas y comprobantes de colaboradores')),
                          DropdownMenuItem(value: 'fiscal', child: Text('Facturas electrónicas y notas DGI')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _entity = val);
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _format,
                        decoration: const InputDecoration(labelText: 'Formato de archivo'),
                        items: const [
                          DropdownMenuItem(value: 'csv', child: Text('CSV (Delimitado por comas / UTF-8)')),
                          DropdownMenuItem(value: 'xlsx', child: Text('Excel (.xlsx)')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _format = val);
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text('Archivos generados recientemente', style: theme.textTheme.titleMedium),
              const SizedBox(height: 12),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _history.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final h = _history[index];
                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                      side: BorderSide(color: theme.colorScheme.outlineVariant),
                    ),
                    child: ListTile(
                      leading: Icon(Icons.file_download_done, color: theme.colorScheme.primary),
                      title: Text(h['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      subtitle: Text('${h['size']} · ${h['date']}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.download),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Descargando ${h['name']}...')),
                          );
                        },
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Generar y descargar exporte',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Generando archivo exportable en segundo plano...')),
              );
            },
          ),
        ),
      ),
    );
  }
}
