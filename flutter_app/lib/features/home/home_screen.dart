import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../account/account_screen.dart';
import '../inbox/inbox_screen.dart';
import '../modules/module_registry.dart';
import '../wallet/topup_screen.dart';
import '../wallet/send_screen.dart';
import '../wallet/receive_screen.dart';
import '../wallet/pay_scan_screen.dart';
import '../pos/pos_sales_history_screen.dart';
import '../pos/pos_close_session_screen.dart';
import '../business/business_dashboard_screen.dart';
import '../business/team_screen.dart';
import '../business/roles_screen.dart';

/// S-GEN-05 · `/` · Inicio (Dashboard principal)
/// Cumple estrictamente con docs/gravital-experience-ui.md (M3 Expressive)
/// y docs/ux/functional-spec/00-transversal.md §S-GEN-05.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.modules,
    required this.onSelectModule,
    required this.onSignOut,
  });

  final ApiClient api;
  final List<ModuleDef> modules;
  final void Function(ModuleDef module) onSelectModule;
  final VoidCallback onSignOut;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _hideBalance = false;

  ModuleDef? _findModule(String id) {
    try {
      return widget.modules.firstWhere((m) => m.id == id);
    } catch (_) {
      return null;
    }
  }

  void _navigateToModule(String id) {
    final mod = _findModule(id);
    if (mod != null) {
      widget.onSelectModule(mod);
    }
  }

  String _moduleDescription(String id) => switch (id) {
        'wallet' => 'Saldo disponible, recargas y transferencias',
        'marketplace' => 'Explorar tiendas, vitrina y compras',
        'pos' => 'Caja registradora, cobros rápidos y tickets',
        'catalog' => 'Productos, precios, variantes y categorías',
        'inventory' => 'Control de existencias, bodegas y lotes',
        'orders' => 'Gestión y preparación de pedidos en vivo',
        'logistics' => 'Envíos a domicilio, despachos y rutas',
        'finance' => 'Facturación fiscal DGI y liquidaciones',
        'payroll' => 'Colaboradores, turnos y nómina reglamentaria',
        'analytics' => 'Reportes de ventas, KPIs y pronósticos',
        'admin' => 'Configuración de la empresa y sucursales',
        'platform' => 'Consola de plataforma y cumplimiento',
        _ => 'Herramientas y operaciones del módulo',
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    final hasWallet = _findModule('wallet') != null;
    final hasPos = _findModule('pos') != null;
    final hasOrders = _findModule('orders') != null;
    final hasLogistics = _findModule('logistics') != null;
    final hasInventory = _findModule('inventory') != null;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            // ── Cabecera y Saludo Personalizado ──────────────────────────────
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: cs.primaryContainer,
                  child: Text(
                    'PP',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: cs.onPrimaryContainer,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '¡Hola de nuevo!',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Comercio Activo · ${widget.modules.length} Módulos',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Avisos y notificaciones',
                  icon: Badge(
                    label: const Text('3'),
                    child: const Icon(Icons.notifications_outlined),
                  ),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => InboxScreen(api: widget.api),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: l10n.accountTitle,
                  icon: const Icon(Icons.account_circle_outlined),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => AccountScreen(api: widget.api),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // ── Tarjeta Billetera Digital (Wallet) ───────────────────────────
            if (hasWallet) ...[
              Card(
                elevation: 0,
                color: cs.surfaceContainerHighest,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => _navigateToModule('wallet'),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.account_balance_wallet_outlined, size: 20, color: cs.primary),
                            const SizedBox(width: 8),
                            Text(
                              l10n.moduleWallet,
                              style: theme.textTheme.labelLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: cs.onSurfaceVariant,
                              ),
                            ),
                            const Spacer(),
                            IconButton(
                              icon: Icon(
                                _hideBalance ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                size: 18,
                              ),
                              tooltip: _hideBalance ? 'Mostrar saldo' : 'Ocultar saldo',
                              onPressed: () => setState(() => _hideBalance = !_hideBalance),
                            ),
                            const Icon(Icons.chevron_right, size: 18),
                          ],
                        ),
                        const SizedBox(height: 4),
                        if (_hideBalance)
                          Text(
                            '••••••••',
                            style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                          )
                        else
                          MoneyText(
                            245000,
                            symbol: r'B/.',
                            style: theme.textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: cs.onSurface,
                            ),
                          ),
                        Text(
                          'Saldo disponible en cuenta',
                          style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                        ),
                        const SizedBox(height: 16),
                        // Acciones rápidas de Billetera
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _QuickActionButton(
                              icon: Icons.add_card_outlined,
                              label: 'Recargar',
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => TopupScreen(api: widget.api),
                                ),
                              ),
                            ),
                            _QuickActionButton(
                              icon: Icons.send_outlined,
                              label: 'Enviar',
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => SendScreen(api: widget.api),
                                ),
                              ),
                            ),
                            _QuickActionButton(
                              icon: Icons.qr_code_2_outlined,
                              label: 'Recibir',
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => ReceiveScreen(api: widget.api),
                                ),
                              ),
                            ),
                            _QuickActionButton(
                              icon: Icons.qr_code_scanner_outlined,
                              label: 'Escanear',
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => PayScanScreen(api: widget.api),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // ── Tarjeta Ventas de Hoy (POS / Caja) ───────────────────────────
            if (hasPos) ...[
              Card(
                elevation: 0,
                color: cs.surfaceContainerHighest,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => _navigateToModule('pos'),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.point_of_sale_outlined, size: 20, color: cs.primary),
                            const SizedBox(width: 8),
                            Text(
                              'Ventas de Hoy',
                              style: theme.textTheme.labelLarge?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: cs.onSurfaceVariant,
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: cs.primaryContainer,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                'Caja Abierta',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: cs.onPrimaryContainer,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right, size: 18),
                          ],
                        ),
                        const SizedBox(height: 6),
                        MoneyText(
                          84250,
                          symbol: r'B/.',
                          style: theme.textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: cs.onSurface,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Text('18 ventas realizadas', style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                            const SizedBox(width: 8),
                            const Text('•'),
                            const SizedBox(width: 8),
                            Text('Ticket prom. B/.46.80', style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.add_shopping_cart, size: 16),
                                label: const Text('Nueva Venta'),
                                onPressed: () => _navigateToModule('pos'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.history, size: 16),
                                label: const Text('Historial'),
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => PosSalesHistoryScreen(api: widget.api),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton.outlined(
                              tooltip: 'Arqueo y Cierre Z',
                              icon: const Icon(Icons.lock_clock, size: 18),
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => PosCloseSessionScreen(api: widget.api),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // ── Fila de Métricas Operativas (Pedidos & Entregas) ─────────────
            if (hasOrders || hasLogistics)
              Row(
                children: [
                  if (hasOrders)
                    Expanded(
                      child: Card(
                        elevation: 0,
                        color: cs.surfaceContainerHighest,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _navigateToModule('orders'),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.receipt_long_outlined, size: 18, color: cs.primary),
                                    const Spacer(),
                                    const Icon(Icons.chevron_right, size: 16),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '3 Activos',
                                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  'Pedidos en cocina',
                                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (hasOrders && hasLogistics) const SizedBox(width: 8),
                  if (hasLogistics)
                    Expanded(
                      child: Card(
                        elevation: 0,
                        color: cs.surfaceContainerHighest,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.5)),
                        ),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => _navigateToModule('logistics'),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.local_shipping_outlined, size: 18, color: cs.primary),
                                    const Spacer(),
                                    const Icon(Icons.chevron_right, size: 16),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '2 en Ruta',
                                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  'Despachos activos',
                                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            if (hasOrders || hasLogistics) const SizedBox(height: 12),

            // ── Alerta de Negocio (Inventario / Fiscal) ──────────────────────
            if (hasInventory) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: cs.tertiaryContainer.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: cs.tertiaryContainer),
                ),
                child: Row(
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 20, color: cs.onTertiaryContainer),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Alerta de Inventario',
                            style: theme.textTheme.labelMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: cs.onTertiaryContainer,
                            ),
                          ),
                          Text(
                            '2 productos con existencias bajo el mínimo.',
                            style: theme.textTheme.bodySmall?.copyWith(color: cs.onTertiaryContainer),
                          ),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => _navigateToModule('inventory'),
                      child: const Text('Revisar'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Todos los Módulos del Sistema (Totalmente Interactivos) ──────
            Row(
              children: [
                Text(
                  'Módulos del Sistema',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                Text(
                  '${widget.modules.length} disponibles',
                  style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 8),

            for (final m in widget.modules)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  elevation: 0,
                  color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: cs.primaryContainer.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(m.icon, color: cs.primary, size: 22),
                    ),
                    title: Text(
                      moduleLabel(l10n, m),
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      _moduleDescription(m.id),
                      style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                    onTap: () => widget.onSelectModule(m),
                  ),
                ),
              ),

            const SizedBox(height: 16),
            // ── Accesos de Gestión y Configuración ───────────────────────────
            Text(
              'Administración y Equipo',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),

            Card(
              elevation: 0,
              color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.business_outlined),
                    title: Text(l10n.businessTitle),
                    subtitle: const Text('Perfil de la empresa, sucursales y KYB'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => BusinessDashboardScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.group_outlined),
                    title: Text(l10n.teamTitle),
                    subtitle: const Text('Colaboradores, cajeros e invitaciones'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => TeamScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.badge_outlined),
                    title: Text(l10n.rolesTitle),
                    subtitle: const Text('Permisos por puesto y supervisión'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => RolesScreen(api: widget.api)),
                    ),
                  ),
                  const Divider(height: 1, indent: 56),
                  ListTile(
                    leading: const Icon(Icons.manage_accounts_outlined),
                    title: Text(l10n.accountTitle),
                    subtitle: const Text('Preferencias, seguridad y sesiones activas'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => AccountScreen(api: widget.api)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: widget.onSignOut,
              icon: const Icon(Icons.logout),
              label: Text(l10n.actionSignOut),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 20, color: cs.primary),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: cs.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
