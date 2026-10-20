import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-CAT-03 · `/catalog/import` · Importación masiva de productos (CSV).
class CatalogImportScreen extends StatefulWidget {
  const CatalogImportScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<CatalogImportScreen> createState() => _CatalogImportScreenState();
}

class _CatalogImportScreenState extends State<CatalogImportScreen> {
  bool _fileSelected = false;
  bool _importing = false;

  final List<Map<String, dynamic>> _previewRows = [
    {
      'sku': 'CAF-001',
      'name': 'Café Geisha 250g',
      'price': 'B/.18.50',
      'tax': '7%',
      'valid': true
    },
    {
      'sku': 'PAN-002',
      'name': 'Croissant Francés',
      'price': 'B/.2.50',
      'tax': '7%',
      'valid': true
    },
    {
      'sku': 'JUG-003',
      'name': 'Jugo de Naranja 500mL',
      'price': 'B/.3.00',
      'tax': '0%',
      'valid': true
    },
    {
      'sku': '',
      'name': 'Producto sin SKU',
      'price': 'B/.1.00',
      'tax': '7%',
      'valid': false,
      'error': 'Falta SKU obligatorio'
    },
  ];

  void _runImport() async {
    setState(() => _importing = true);
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          content: Text(
              '3 productos importados correctamente. 1 fila con error omitida.')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Importar catálogo CSV')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                color: theme.colorScheme.surfaceContainerLow,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Icon(Icons.upload_file,
                          size: 48, color: theme.colorScheme.primary),
                      const SizedBox(height: 8),
                      Text(
                        _fileSelected
                            ? 'catalogo_octubre.csv (4 filas)'
                            : 'Seleccionar archivo CSV',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Columnas: sku, name, price, tax_rate, unit, stock',
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: () => setState(() => _fileSelected = true),
                        child: Text(_fileSelected
                            ? 'Cambiar archivo'
                            : 'Examinar archivo'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (_fileSelected) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Vista previa de datos',
                        style: theme.textTheme.titleMedium),
                    const StatusChip(
                        label: '3 válidos · 1 error', tone: StatusTone.warning),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.separated(
                    itemCount: _previewRows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, i) {
                      final row = _previewRows[i];
                      final isValid = row['valid'] as bool;
                      return Card(
                        child: ListTile(
                          dense: true,
                          leading: Icon(
                            isValid ? Icons.check_circle : Icons.error,
                            color: isValid
                                ? Colors.green
                                : theme.colorScheme.error,
                          ),
                          title: Text(row['name'] as String),
                          subtitle: Text(
                            isValid
                                ? 'SKU: ${row['sku']} · ${row['price']} · ITBMS: ${row['tax']}'
                                : 'Error: ${row['error']}',
                            style: TextStyle(
                                color:
                                    isValid ? null : theme.colorScheme.error),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                PPButton.primary(
                  label: 'Confirmar e importar productos',
                  onPressed: _importing ? null : _runImport,
                ),
              ] else ...[
                const Spacer(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
