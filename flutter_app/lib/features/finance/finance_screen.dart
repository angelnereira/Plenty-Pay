import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../fiscal/fiscal_profile_screen.dart';
import '../fiscal/invoices_screen.dart';
import 'payout_settings_screen.dart';
import 'payments_list_screen.dart';
import 'settlements_screen.dart';
import 'tax_report_screen.dart';
import 'taxpayers_screen.dart';
import 'terminals_screen.dart';

/// S-FIN-01 · `/finance` · Resumen financiero y tesorería del comercio.
///
/// Permisos: `payments:read`, `settlement:read`.
/// Centro de control para cobros, liquidaciones, facturación electrónica y cumplimiento fiscal DGI.
class FinanceScreen extends StatelessWidget {
  const FinanceScreen({super.key, required this.api});

  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Finanzas y Facturación'),
        actions: [
          IconButton(
            tooltip: 'Configuración de transferencias',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PayoutSettingsScreen(api: api)),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Balance summary card
              Container(
                padding: const EdgeInsets.all(AppTokens.spacingLg),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Por liquidar en próximo corte ACH',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                    const SizedBox(height: 8),
                    MoneyText(
                      345000, // $3,450.00
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Próximo depósito: Hoy a las 5:00 PM · Banco General (**** 8912)',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // KPI Row
              Row(
                children: [
                  Expanded(
                    child: Card(
                      elevation: 0,
                      color: theme.colorScheme.surfaceContainerLow,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                        side: BorderSide(color: theme.colorScheme.outlineVariant),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Cobrado hoy', style: theme.textTheme.labelSmall),
                            const SizedBox(height: 4),
                            MoneyText(
                              98450, // $984.50
                              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Card(
                      elevation: 0,
                      color: theme.colorScheme.surfaceContainerLow,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTokens.radiusMd),
                        side: BorderSide(color: theme.colorScheme.outlineVariant),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Esta semana', style: theme.textTheme.labelSmall),
                            const SizedBox(height: 4),
                            MoneyText(
                              512400, // $5,124.00
                              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              Text('Módulos y herramientas financieras', style: theme.textTheme.titleMedium),
              const SizedBox(height: 12),

              _buildNavTile(
                context,
                icon: Icons.payments_outlined,
                title: 'Cobros y transacciones',
                subtitle: 'Historial por rieles: CLAVE, ACH, Yappy, Tarjetas',
                destination: PaymentsListScreen(api: api),
              ),
              _buildNavTile(
                context,
                icon: Icons.account_balance_outlined,
                title: 'Lotes de liquidación',
                subtitle: 'Cortes y transferencias recibidas en tu cuenta bancaria',
                destination: SettlementsScreen(api: api),
              ),
              _buildNavTile(
                context,
                icon: Icons.contactless_outlined,
                title: 'Terminales QR y NFC',
                subtitle: 'Mostradores de cobro, stickers NFC y dispositivos POS',
                destination: TerminalsScreen(api: api),
              ),
              _buildNavTile(
                context,
                icon: Icons.receipt_long_outlined,
                title: 'Facturación electrónica DGI',
                subtitle: 'Facturas autorizadas, CUFE, XML firmado y notas de crédito',
                destination: InvoicesScreen(api: api),
              ),
              _buildNavTile(
                context,
                icon: Icons.badge_outlined,
                title: 'Perfil fiscal y PAC',
                subtitle: 'RUC, DV, resolución DGI y credenciales del proveedor PAC',
                destination: FiscalProfileScreen(api: api),
              ),
              _buildNavTile(
                context,
                icon: Icons.people_outline,
                title: 'Receptores electrónicos',
                subtitle: 'Directorio de clientes con RUC y correo para facturas',
                destination: TaxpayersScreen(api: api),
              ),
              _buildNavTile(
                context,
                icon: Icons.description_outlined,
                title: 'Informe mensual ITBMS (N-FIS-11)',
                subtitle: 'Resumen por tarifas (7%, 10%, 15%, Exento) para formulario DGI',
                destination: TaxReportScreen(api: api),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: PPButton.primary(
            label: 'Ver todos los cobros del día',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => PaymentsListScreen(api: api)),
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
