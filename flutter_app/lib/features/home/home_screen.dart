import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/pp_button.dart';
import '../account/account_screen.dart';
import '../business/business_create_screen.dart';
import '../modules/module_registry.dart';
import '../wallet/feature_unavailable.dart';
import '../wallet/pay_scan_screen.dart';
import '../wallet/send_screen.dart';
import '../wallet/topup_screen.dart';
import '../wallet/wallet_data.dart';
import '../wallet/wallet_screen.dart'
    show WalletActionButton, WalletBalanceCard;

/// S-GEN-05 · `/` · Inicio. Solo datos reales:
/// - e1 saludo;
/// - e2 avisos (la bandeja S-GEN-06 llega con F20: sin contador inventado);
/// - e4 tarjeta Billetera con el saldo del ledger;
/// - acceso para registrar un negocio si la persona no tiene uno (estado vacío).
///
/// Ventas de hoy (e5), pedidos (e6), entregas (e7) y alertas (e8) aparecen cuando sus servicios
/// estén desplegados (F15–F18). La navegación por módulos es del `AppShell` (e9).
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
  late Future<WalletBalance> _balance = loadWalletBalance(widget.api);
  late final Future<Me> _me = widget.api.me();

  ModuleDef? _module(String id) {
    for (final m in widget.modules) {
      if (m.id == id) return m;
    }
    return null;
  }

  void _push(Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen))
      .then((_) => setState(() {
            _balance = loadWalletBalance(widget.api);
          }));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final wallet = _module('wallet');

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
          children: [
            Row(children: [
              Expanded(
                  child: Text(l10n.homeGreeting,
                      style: theme.textTheme.headlineSmall)),
              IconButton(
                tooltip: l10n.homeNotifications,
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () => _push(FeatureUnavailableScreen(
                    title: l10n.homeNotifications,
                    message: l10n.featureUnavailableBody)),
              ),
              IconButton(
                tooltip: l10n.accountTitle,
                icon: const Icon(Icons.account_circle_outlined),
                onPressed: () => _push(AccountScreen(api: widget.api)),
              ),
            ]),
            const SizedBox(height: AppTokens.spacingMd),
            if (wallet != null) ...[
              FutureBuilder<WalletBalance>(
                future: _balance,
                builder: (context, snap) => AsyncView<WalletBalance>(
                  snapshot: snap,
                  errorMessage: snap.hasError
                      ? walletErrorMessage(l10n, snap.error!)
                      : l10n.errorNoConnection,
                  retryLabel: l10n.actionRetry,
                  onRetry: () => setState(() {
                    _balance = loadWalletBalance(widget.api);
                  }),
                  emptyView: const SizedBox.shrink(),
                  builder: (context, balance) => GestureDetector(
                    onTap: () => widget.onSelectModule(wallet),
                    child: WalletBalanceCard(
                      balance: balance,
                      footer: Row(children: [
                        for (final (icon, label, screen) in [
                          (
                            Icons.add,
                            l10n.topupTitle,
                            TopupScreen(api: widget.api) as Widget
                          ),
                          (
                            Icons.send_outlined,
                            l10n.sendTitle,
                            SendScreen(api: widget.api)
                          ),
                          (
                            Icons.qr_code_scanner,
                            l10n.walletPay,
                            PayScanScreen(api: widget.api)
                          ),
                        ])
                          Expanded(
                              child: WalletActionButton(
                                  icon: icon,
                                  label: label,
                                  onTap: () => _push(screen))),
                      ]),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppTokens.spacingMd),
            ],
            FutureBuilder<Me>(
              future: _me,
              builder: (context, snap) {
                final me = snap.data;
                if (me == null || me.tenantId.isNotEmpty) {
                  return const SizedBox.shrink();
                }
                return PPButton.secondary(
                  label: l10n.homeRegisterBusiness,
                  onPressed: () => _push(BusinessCreateScreen(api: widget.api)),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
