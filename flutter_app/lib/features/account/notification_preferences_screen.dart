import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-GEN-07 · `/account/notifications` · Preferencias de avisos.
///
/// Configuración de canales (in-app, push, email, WhatsApp).
/// Regla R2/R6 de notifications: los avisos de seguridad y transaccionales no se pueden desactivar.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<NotificationPreferencesScreen> createState() => _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState extends State<NotificationPreferencesScreen> {
  bool _pushPayments = true;
  bool _emailReceipts = true;
  bool _pushDelivery = true;
  bool _marketingEmail = false;
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    await Future<void>.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Preferencias actualizadas.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Preferencias de avisos')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: theme.colorScheme.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.lock_outline, color: theme.colorScheme.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Avisos de seguridad obligatorios', style: theme.textTheme.titleSmall),
                          const SizedBox(height: 2),
                          Text(
                            'Por seguridad y cumplimiento legal, las alertas de inicio de sesión y movimientos siempre se enviarán.',
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    const StatusChip(label: 'Fijo', tone: StatusTone.info),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            Text('Pagos y billetera', style: theme.textTheme.titleMedium),
            SwitchListTile(
              title: const Text('Notificaciones push de cobros y pagos'),
              subtitle: const Text('Aviso inmediato en tu pantalla al recibir o enviar dinero.'),
              value: _pushPayments,
              onChanged: (v) => setState(() => _pushPayments = v),
            ),
            SwitchListTile(
              title: const Text('Comprobantes y recibos por correo'),
              subtitle: const Text('Envío automático de recibo digital tras cada compra.'),
              value: _emailReceipts,
              onChanged: (v) => setState(() => _emailReceipts = v),
            ),
            const Divider(),

            Text('Entregas y pedidos', style: theme.textTheme.titleMedium),
            SwitchListTile(
              title: const Text('Seguimiento de entrega en tiempo real'),
              subtitle: const Text('Avisos cuando el repartidor está en camino o llegó.'),
              value: _pushDelivery,
              onChanged: (v) => setState(() => _pushDelivery = v),
            ),
            const Divider(),

            Text('Novedades y promociones', style: theme.textTheme.titleMedium),
            SwitchListTile(
              title: const Text('Correos de ofertas y nuevos comercios'),
              subtitle: const Text('Descuentos y novedades destacadas de PlentyPay.'),
              value: _marketingEmail,
              onChanged: (v) => setState(() => _marketingEmail = v),
            ),
            const SizedBox(height: 24),

            PPButton.primary(
              label: 'Guardar preferencias',
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
