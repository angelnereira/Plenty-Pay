import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/status_chip.dart';
import 'audit_log_screen.dart';
import 'business_privacy_screen.dart';
import 'integrations_screen.dart';
import 'notification_templates_screen.dart';
import 'roles_screen.dart';
import 'team_screen.dart';

/// S-ADM-01 · `/business` · Perfil de la empresa, sucursales y gestión administrativa.
///
/// Permiso: `admin:business:manage`.
/// Muestra los datos fiscales del negocio, estado de revisión KYB, aviso de operación y sucursales activas.
class BusinessDashboardScreen extends StatefulWidget {
  const BusinessDashboardScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<BusinessDashboardScreen> createState() => _BusinessDashboardScreenState();
}

class _BusinessDashboardScreenState extends State<BusinessDashboardScreen> {
  final Map<String, dynamic> _business = {
    'name': 'COMERCIALIZADORA DEL PACÍFICO S.A.',
    'trade_name': 'Supermercado Gourmet Marbella',
    'ruc': '155678234-2-2021',
    'dv': '45',
    'mici_license': 'AVISO-2021-98421 (MICI)',
    'kyb_status': StatusChipTone.success,
    'kyb_label': 'KYB Verificado',
    'branches': [
      {'name': 'Casa Matriz Marbella', 'address': 'Calle 47 Este, Plaza 2000', 'active': true},
      {'name': 'Sucursal San Francisco', 'address': 'Calle 74 Este, Casa 22', 'active': true},
      {'name': 'Bodega Central Milla 8', 'address': 'Parque Industrial Milla 8, Galera B-4', 'active': true},
    ],
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Negocio'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Business profile card
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              _business['trade_name'] as String,
                              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                            ),
                          ),
                          StatusChip(
                            label: _business['kyb_label'] as String,
                            tone: _business['kyb_status'] as StatusChipTone,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('Razón Social: ${_business['name']}', style: theme.textTheme.bodyMedium),
                      Text('RUC: ${_business['ruc']} DV ${_business['dv']}', style: theme.textTheme.bodySmall),
                      Text('Aviso de Operación: ${_business['mici_license']}', style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Branches
              Card(
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
                          Text('Sucursales (${(_business['branches'] as List).length})', style: theme.textTheme.titleMedium),
                          TextButton(onPressed: () {}, child: const Text('Agregar')),
                        ],
                      ),
                      const SizedBox(height: 8),
                      for (final b in (_business['branches'] as List))
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Icon(Icons.storefront_outlined, size: 20, color: theme.colorScheme.primary),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(b['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                                    Text(b['address'] as String, style: theme.textTheme.bodySmall),
                                  ],
                                ),
                              ),
                              const StatusChip(label: 'Operativa', tone: StatusChipTone.success),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              Text('Administración y configuración', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),

              _buildNavTile(
                context,
                icon: Icons.people_outline,
                title: 'Equipo y colaboradores',
                subtitle: 'Invitaciones, asignación de usuarios y control de acceso',
                destination: TeamScreen(api: widget.api),
              ),
              _buildNavTile(
                context,
                icon: Icons.security_outlined,
                title: 'Roles y permisos personalizados',
                subtitle: 'Matriz granular de permisos agrupada por módulos',
                destination: RolesScreen(api: widget.api),
              ),
              _buildNavTile(
                context,
                icon: Icons.hub_outlined,
                title: 'Integraciones y API',
                subtitle: 'Rieles de pago, PAC DGI, WhatsApp Cloud y Webhooks',
                destination: IntegrationsScreen(api: widget.api),
              ),
              _buildNavTile(
                context,
                icon: Icons.sms_outlined,
                title: 'Plantillas de notificaciones',
                subtitle: 'Comprobantes digitales y avisos por WhatsApp/SMS',
                destination: NotificationTemplatesScreen(api: widget.api),
              ),
              _buildNavTile(
                context,
                icon: Icons.history_edu_outlined,
                title: 'Bitácora de auditoría inmutable',
                subtitle: 'Registro de seguridad criptográfico con cadena de bloques',
                destination: AuditLogScreen(api: widget.api),
              ),
              _buildNavTile(
                context,
                icon: Icons.privacy_tip_outlined,
                title: 'Privacidad y derechos ARCO (Ley 81)',
                subtitle: 'Atención de solicitudes de datos de clientes y empleados',
                destination: BusinessPrivacyScreen(api: widget.api),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Editar perfil comercial',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Abriendo edición de datos del comercio...')),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildNavTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required Widget destination,
  }) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTokens.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.surfaceContainerHighest,
          child: Icon(icon, color: theme.colorScheme.primary),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: theme.textTheme.bodySmall),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => destination));
        },
      ),
    );
  }
}
