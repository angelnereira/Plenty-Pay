import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-CAT-05 · `/catalog/storefront` · Mi vitrina y publicación en marketplace.
class StorefrontSettingsScreen extends StatefulWidget {
  const StorefrontSettingsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<StorefrontSettingsScreen> createState() => _StorefrontSettingsScreenState();
}

class _StorefrontSettingsScreenState extends State<StorefrontSettingsScreen> {
  bool _published = true;
  final _slugController = TextEditingController(text: 'cafe-panama-centro');
  final _bioController = TextEditingController(text: 'Cafetería de especialidad con granos de Boquete y Volcán.');
  final _minOrderController = TextEditingController(text: '5.00');

  @override
  void dispose() {
    _slugController.dispose();
    _bioController.dispose();
    _minOrderController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Mi vitrina y Marketplace')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: SwitchListTile(
                title: const Text('Publicar tienda en el Marketplace'),
                subtitle: const Text('Tus productos serán visibles para compradores en la app PlentyPay.'),
                value: _published,
                onChanged: (v) => setState(() => _published = v),
              ),
            ),
            const SizedBox(height: 16),

            Text('Enlace público de tu vitrina', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            PPTextField(
              controller: _slugController,
              labelText: 'Identificador único (slug)',
              prefixText: 'plentypay.app/s/',
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            PPTextField(
              controller: _bioController,
              labelText: 'Descripción pública de tu negocio',
              maxLines: 3,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 16),

            PPTextField(
              controller: _minOrderController,
              labelText: 'Pedido mínimo para entrega a domicilio (B/.)',
              prefixText: 'B/. ',
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 24),

            PPButton.primary(
              label: 'Guardar configuración de vitrina',
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Vitrina actualizada y publicada en el marketplace.')),
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
