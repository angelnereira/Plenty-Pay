import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// S-ADM-05 · `/business/templates` · Plantillas de mensajería y notificaciones.
///
/// Permiso: `notifications:template:manage`.
/// Permite configurar los textos y variables de sustitución para WhatsApp, SMS y correo electrónico.
class NotificationTemplatesScreen extends StatefulWidget {
  const NotificationTemplatesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<NotificationTemplatesScreen> createState() =>
      _NotificationTemplatesScreenState();
}

class _NotificationTemplatesScreenState
    extends State<NotificationTemplatesScreen> {
  final List<Map<String, dynamic>> _templates = [
    {
      'id': 'TPL-01',
      'title': 'Recibo digital de compra',
      'channel': 'WhatsApp + Email',
      'body':
          'Hola {{cliente}}, gracias por tu compra en {{comercio}}. Tu comprobante electrónico por {{monto}} está disponible en: {{enlace_recibo}}',
      'active': true,
    },
    {
      'id': 'TPL-02',
      'title': 'Pedido en camino con repartidor',
      'channel': 'WhatsApp + Push',
      'body':
          'Tu pedido {{pedido_id}} va en camino. Sigue la entrega en vivo con tu repartidor: {{enlace_tracking}}',
      'active': true,
    },
    {
      'id': 'TPL-03',
      'title': 'Confirmación de pago recibido',
      'channel': 'SMS + Push',
      'body':
          'PlentyPay: Pago confirmado de {{monto}} a {{comercio}}. Ref: {{ref_id}}',
      'active': true,
    },
  ];

  void _showAddTemplateDialog() {
    final titleCtrl = TextEditingController();
    final bodyCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppTokens.radiusLg)),
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
            Text('Nueva plantilla de mensaje',
                style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: titleCtrl,
              decoration: const InputDecoration(
                  labelText: 'Nombre o propósito de la plantilla'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: bodyCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Cuerpo del mensaje',
                hintText:
                    'Usa variables como {{cliente}}, {{monto}}, {{enlace_recibo}}...',
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: [
                ActionChip(label: const Text('{{cliente}}'), onPressed: () {}),
                ActionChip(label: const Text('{{monto}}'), onPressed: () {}),
                ActionChip(
                    label: const Text('{{enlace_recibo}}'), onPressed: () {}),
              ],
            ),
            const SizedBox(height: 20),
            PPButton.primary(
              label: 'Guardar plantilla',
              onPressed: () {
                if (titleCtrl.text.trim().isNotEmpty) {
                  setState(() {
                    _templates.add({
                      'id': 'TPL-0${_templates.length + 1}',
                      'title': titleCtrl.text.trim(),
                      'channel': 'WhatsApp',
                      'body': bodyCtrl.text.trim(),
                      'active': true,
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
        title: const Text('Plantillas de mensajería'),
      ),
      body: SafeArea(
        child: ListView.separated(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          itemCount: _templates.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final t = _templates[index];
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
                        Text(t['title'] as String,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16)),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.secondaryContainer,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(t['channel'] as String,
                              style: const TextStyle(
                                  fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerHigh,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(t['body'] as String,
                          style: theme.textTheme.bodyMedium),
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
            label: 'Crear nueva plantilla',
            onPressed: _showAddTemplateDialog,
          ),
        ),
      ),
    );
  }
}
