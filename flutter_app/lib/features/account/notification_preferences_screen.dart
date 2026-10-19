import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';

/// S-GEN-11 · `/account/notifications` · Preferencias de avisos.
/// Cumple con docs/gravital-experience-ui.md (M3 Expressive) y docs/ux/functional-spec/00-transversal.md.
/// Regla R2/R6 de notifications: los avisos de seguridad y transaccionales no se pueden desactivar.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<NotificationPreferencesScreen> createState() => _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState extends State<NotificationPreferencesScreen> {
  // Pagos
  bool _pushPayments = true;
  bool _emailReceipts = true;
  bool _settlementAch = true;

  // Pedidos y Logística
  bool _pushOrders = true;
  bool _pushDelivery = true;

  // Nómina y Asistencia
  bool _payrollAlerts = true;
  bool _clockInAlerts = true;

  // Novedades
  bool _marketingEmail = false;

  // Horario no molestar
  bool _quietHoursEnabled = true;
  TimeOfDay _quietStart = const TimeOfDay(hour: 22, minute: 0);
  TimeOfDay _quietEnd = const TimeOfDay(hour: 7, minute: 0);

  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Preferencias de avisos guardadas correctamente.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Preferencias de Avisos')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            // ── Banner Informativo de Avisos de Seguridad Obligatorios ────────
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: cs.primary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.shield_outlined, color: cs.primary, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Avisos de seguridad obligatorios',
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Por normativa legal y protección contra fraude, las alertas de inicio de sesión y movimientos siempre se enviarán.',
                            style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
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
            const SizedBox(height: 16),

            // ── Pagos y Cobros ───────────────────────────────────────────────
            Text(
              'Pagos y Transacciones',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Cobros y ventas en tiempo real'),
                    subtitle: const Text('Notificación inmediata al cobrar por POS, QR o billetera.'),
                    value: _pushPayments,
                    onChanged: (v) => setState(() => _pushPayments = v),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  SwitchListTile(
                    title: const Text('Comprobantes de pago por correo'),
                    subtitle: const Text('Envío automático de factura electrónica o recibo fiscal.'),
                    value: _emailReceipts,
                    onChanged: (v) => setState(() => _emailReceipts = v),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  SwitchListTile(
                    title: const Text('Liquidaciones bancarias ACH'),
                    subtitle: const Text('Aviso cuando PlentyPay deposite fondos a tu cuenta.'),
                    value: _settlementAch,
                    onChanged: (v) => setState(() => _settlementAch = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Pedidos y Logística ──────────────────────────────────────────
            Text(
              'Pedidos y Logística',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Nuevos pedidos en tienda'),
                    subtitle: const Text('Alerta sonora al ingresar un nuevo pedido para cocina.'),
                    value: _pushOrders,
                    onChanged: (v) => setState(() => _pushOrders = v),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  SwitchListTile(
                    title: const Text('Seguimiento de repartidor en ruta'),
                    subtitle: const Text('Avisos de despacho, proximidad y entrega con código POD.'),
                    value: _pushDelivery,
                    onChanged: (v) => setState(() => _pushDelivery = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Nómina y Equipo ──────────────────────────────────────────────
            Text(
              'Nómina y Asistencia',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Cierre y pago de quincena'),
                    subtitle: const Text('Notificación al procesar la corrida de nómina.'),
                    value: _payrollAlerts,
                    onChanged: (v) => setState(() => _payrollAlerts = v),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  SwitchListTile(
                    title: const Text('Alertas de tardanzas y turnos'),
                    subtitle: const Text('Avisos si un colaborador no ha registrado marcaje.'),
                    value: _clockInAlerts,
                    onChanged: (v) => setState(() => _clockInAlerts = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Horario de Silencio ──────────────────────────────────────────
            Text(
              'Horario de No Molestar',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  SwitchListTile(
                    title: const Text('Silenciar alertas nocturnas'),
                    subtitle: Text(
                      'No emitir sonidos entre las ${_quietStart.format(context)} y las ${_quietEnd.format(context)} (excepto emergencias de seguridad).',
                    ),
                    value: _quietHoursEnabled,
                    onChanged: (v) => setState(() => _quietHoursEnabled = v),
                  ),
                  if (_quietHoursEnabled) ...[
                    const Divider(height: 1, indent: 16, endIndent: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () async {
                                final time = await showTimePicker(context: context, initialTime: _quietStart);
                                if (time != null) setState(() => _quietStart = time);
                              },
                              child: Text('Inicio: ${_quietStart.format(context)}'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () async {
                                final time = await showTimePicker(context: context, initialTime: _quietEnd);
                                if (time != null) setState(() => _quietEnd = time);
                              },
                              child: Text('Fin: ${_quietEnd.format(context)}'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Promociones y Mercadeo ───────────────────────────────────────
            Text(
              'Novedades y Mercadeo',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: SwitchListTile(
                title: const Text('Correos de novedades y promociones'),
                subtitle: const Text('Noticias sobre nuevas funciones, integraciones y ventajas comerciales.'),
                value: _marketingEmail,
                onChanged: (v) => setState(() => _marketingEmail = v),
              ),
            ),
            const SizedBox(height: 24),

            // ── Único Botón Filled por Pantalla (§15.3 gravital-experience-ui) ─
            PPButton.primary(
              label: 'Guardar preferencias',
              loading: _saving,
              onPressed: _save,
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
