import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show LogLevel;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../account/account_screen.dart';
import '../business/business_create_screen.dart';
import '../fiscal/fiscal_profile_screen.dart';
import '../modules/module_registry.dart';
import '../wallet/feature_unavailable.dart';
import '../wallet/pay_scan_screen.dart';
import '../wallet/send_screen.dart';
import '../wallet/topup_screen.dart';
import '../wallet/wallet_data.dart';
import '../wallet/wallet_screen.dart'
    show WalletActionButton, WalletBalanceCard;
import 'home_data.dart';

/// S-GEN-05 · `/` · Inicio. Solo datos reales, una tarjeta por módulo visible:
/// - e1 saludo con el nombre; e2 avisos (la bandeja S-GEN-06 llega con F20: sin contador inventado);
/// - e3 un pendiente (negocio en revisión, rechazado o suspendido; perfil fiscal por completar);
/// - e4 Billetera con el saldo del ledger;
/// - e5 Ventas de hoy (pos o finanzas); e6 Pedidos por aceptar con el plazo más cercano;
/// - e8 Alertas: existencias bajas y folios por agotarse;
/// - acceso para registrar un negocio si la persona no tiene uno (estado vacío).
///
/// e7 (entregas activas) aparece cuando logistics esté desplegado (F18). Cada tarjeta carga por su
/// cuenta: si su servicio falla, se registra el fallo y la tarjeta no se muestra.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.modules,
    required this.onSelectModule,
    required this.onSignOut,
    this.now,
  });

  final ApiClient api;
  final List<ModuleDef> modules;
  final void Function(ModuleDef module) onSelectModule;
  final VoidCallback onSignOut;

  /// Reloj inyectable para pruebas.
  final DateTime Function()? now;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<WalletBalance> _balance;
  late Future<Me> _me;
  Future<HomePending?>? _pending;
  Future<HomeSales?>? _sales;
  Future<HomePendingOrders?>? _orders;
  Future<List<HomeAlert>?>? _alerts;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void initState() {
    super.initState();
    _reload();
  }

  ModuleDef? _module(String id) {
    for (final m in widget.modules) {
      if (m.id == id && m.live) return m;
    }
    return null;
  }

  /// Un fallo de una tarjeta se registra una vez y la tarjeta no se muestra (AGENTS.md §2.14).
  Future<T?> _card<T>(String name, Future<T?> Function() load) async {
    try {
      return await load();
    } on Object catch (e, stack) {
      widget.api.logger.error('home card failed', e, stack,
          widget: 'home.$name',
          level: e is ApiException ? LogLevel.warn : LogLevel.error,
          attributes: {'pp.screen': '/'});
      return null;
    }
  }

  void _reload() {
    _balance = loadWalletBalance(widget.api);
    _me = widget.api.me();
    final business = _module('pos') != null ||
        _module('finance') != null ||
        _module('orders') != null ||
        _module('inventory') != null ||
        _module('admin') != null;
    if (!business) {
      _pending = _sales = _orders = _alerts = null;
      return;
    }
    final perms = _me.then((_) => widget.api.permissions());
    _pending = _card<HomePending>('pending',
        () async => loadHomePending(widget.api, await _me, await perms));
    _sales = (_module('pos') != null || _module('finance') != null)
        ? _card<HomeSales>('sales', () async {
            if (!(await perms).can('pos:sell')) return null;
            return loadTodaySales(widget.api, _now());
          })
        : null;
    _orders = _module('orders') != null
        ? _card<HomePendingOrders>('orders', () async {
            if (!(await perms).can('orders:read')) return null;
            return loadPendingOrders(widget.api);
          })
        : null;
    _alerts = _card<List<HomeAlert>>(
        'alerts',
        () async => loadHomeAlerts(widget.api, await perms,
            inventory: _module('inventory') != null,
            finance: _module('finance') != null));
  }

  void _push(Widget screen) => Navigator.of(context)
      .push(MaterialPageRoute<void>(builder: (_) => screen))
      .then((_) => setState(_reload));

  void _open(String moduleId) {
    final m = _module(moduleId);
    if (m != null) widget.onSelectModule(m);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final wallet = _module('wallet');

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            setState(_reload);
            await _balance.then((_) {}, onError: (_) {});
          },
          child: ListView(
            padding: EdgeInsets.fromLTRB(
                margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
            children: [
              // e1 + e2
              Row(children: [
                Expanded(
                  child: FutureBuilder<Me>(
                    future: _me,
                    builder: (context, snap) {
                      final name = (snap.data?.fullName ?? '').trim();
                      return Semantics(
                        header: true,
                        child: Text(
                            name.isEmpty
                                ? l10n.homeGreeting
                                : l10n.homeGreetingName(name.split(' ').first),
                            style: theme.textTheme.headlineSmall),
                      );
                    },
                  ),
                ),
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
              // e3
              if (_pending != null)
                _Loaded<HomePending?>(
                  future: _pending!,
                  builder: (p) => p == null ? null : _pendingCard(l10n, p),
                ),
              // e4
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
              // e5
              if (_sales != null)
                _Loaded<HomeSales?>(
                  future: _sales!,
                  builder: (s) => s == null
                      ? null
                      : _HomeCard(
                          icon: Icons.point_of_sale_outlined,
                          title: l10n.homeSalesToday,
                          value: MoneyText(s.totalMinor,
                              style: theme.textTheme.headlineSmall),
                          subtitle: l10n.homeSalesCount(s.count),
                          onTap: () => _open(
                              _module('finance') != null ? 'finance' : 'pos'),
                        ),
                ),
              // e6
              if (_orders != null)
                _Loaded<HomePendingOrders?>(
                  future: _orders!,
                  builder: (o) => o == null || o.count == 0
                      ? null
                      : _HomeCard(
                          icon: Icons.receipt_long_outlined,
                          title: l10n.homeOrdersPending,
                          value: Text(l10n.homeOrdersCount(o.count),
                              style: theme.textTheme.titleLarge),
                          subtitleWidget: o.nextDeadline == null
                              ? null
                              : _Countdown(
                                  deadline: o.nextDeadline!, now: _now),
                          onTap: () => _open('orders'),
                        ),
                ),
              // e8
              if (_alerts != null)
                _Loaded<List<HomeAlert>?>(
                  future: _alerts!,
                  builder: (alerts) => alerts == null || alerts.isEmpty
                      ? null
                      : _alertsCard(l10n, theme, alerts),
                ),
              FutureBuilder<Me>(
                future: _me,
                builder: (context, snap) {
                  final me = snap.data;
                  if (me == null || me.tenantId.isNotEmpty) {
                    return const SizedBox.shrink();
                  }
                  return PPButton.secondary(
                    label: l10n.homeRegisterBusiness,
                    onPressed: () =>
                        _push(BusinessCreateScreen(api: widget.api)),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pendingCard(AppLocalizations l10n, HomePending p) {
    final (icon, title, body, VoidCallback onTap) = switch (p) {
      HomePending.businessReview => (
          Icons.hourglass_top_outlined,
          l10n.homePendingReview,
          l10n.homePendingReviewBody,
          () => _open('admin')
        ),
      HomePending.businessRejected => (
          Icons.block_outlined,
          l10n.homePendingRejected,
          l10n.homePendingBusinessBody,
          () => _open('admin')
        ),
      HomePending.businessSuspended => (
          Icons.pause_circle_outline,
          l10n.homePendingSuspended,
          l10n.homePendingBusinessBody,
          () => _open('admin')
        ),
      HomePending.fiscalProfile => (
          Icons.receipt_outlined,
          l10n.homePendingFiscal,
          l10n.homePendingFiscalBody,
          () => _push(FiscalProfileScreen(api: widget.api))
        ),
    };
    return _HomeCard(
        icon: icon,
        title: title,
        subtitle: body,
        onTap: onTap,
        tone: _CardTone.attention);
  }

  Widget _alertsCard(
      AppLocalizations l10n, ThemeData theme, List<HomeAlert> alerts) {
    return _HomeCard(
      icon: Icons.warning_amber_outlined,
      title: l10n.homeAlerts(alerts.length),
      tone: _CardTone.attention,
      children: [
        for (final a in alerts)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(switch (a.kind) {
              HomeAlertKind.lowStock => l10n.homeAlertLowStock(a.count),
              HomeAlertKind.foliosLow => l10n.homeAlertFolios(a.count),
            }),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => switch (a.kind) {
              HomeAlertKind.lowStock => _open('inventory'),
              HomeAlertKind.foliosLow =>
                _push(FiscalProfileScreen(api: widget.api)),
            },
          ),
      ],
    );
  }
}

/// Muestra el resultado de una tarjeta cuando llega; mientras carga o si no aplica, nada.
class _Loaded<T> extends StatelessWidget {
  const _Loaded({required this.future, required this.builder});
  final Future<T> future;
  final Widget? Function(T value) builder;

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: future,
        builder: (context, snap) {
          final child =
              snap.hasData || snap.connectionState == ConnectionState.done
                  ? builder(snap.data as T)
                  : null;
          if (child == null) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(bottom: AppTokens.spacingMd),
            child: child,
          );
        },
      );
}

enum _CardTone { normal, attention }

/// Tarjeta de Inicio: jerarquía por tono de superficie (gravital-experience-ui §6).
class _HomeCard extends StatelessWidget {
  const _HomeCard({
    required this.icon,
    required this.title,
    this.value,
    this.subtitle,
    this.subtitleWidget,
    this.onTap,
    this.children = const [],
    this.tone = _CardTone.normal,
  });

  final IconData icon;
  final String title;
  final Widget? value;
  final String? subtitle;
  final Widget? subtitleWidget;
  final VoidCallback? onTap;
  final List<Widget> children;
  final _CardTone tone;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final attention = tone == _CardTone.attention;
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: attention ? scheme.secondaryContainer : scheme.surfaceContainerLow,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Icon(icon,
                    color: attention
                        ? scheme.onSecondaryContainer
                        : scheme.primary),
                const SizedBox(width: AppTokens.spacingSm),
                Expanded(
                    child: Text(title,
                        style: theme.textTheme.titleMedium?.copyWith(
                            color: attention
                                ? scheme.onSecondaryContainer
                                : null))),
                if (onTap != null) const Icon(Icons.chevron_right),
              ]),
              if (value != null) ...[
                const SizedBox(height: AppTokens.spacingSm),
                value!,
              ],
              if (subtitle != null) ...[
                const SizedBox(height: AppTokens.spacingXs),
                Text(subtitle!,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: attention
                            ? scheme.onSecondaryContainer
                            : scheme.onSurfaceVariant)),
              ],
              if (subtitleWidget != null) ...[
                const SizedBox(height: AppTokens.spacingXs),
                subtitleWidget!,
              ],
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}

/// e6: «vence en mm:ss», actualizado cada segundo.
class _Countdown extends StatefulWidget {
  const _Countdown({required this.deadline, required this.now});
  final DateTime deadline;
  final DateTime Function() now;

  @override
  State<_Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<_Countdown> {
  late final Timer _timer =
      Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final left = widget.deadline.difference(widget.now());
    final theme = Theme.of(context);
    if (left.isNegative) {
      return Text(l10n.homeOrdersExpired,
          style: theme.textTheme.bodyMedium
              ?.copyWith(color: theme.colorScheme.error));
    }
    final mm = left.inMinutes.toString().padLeft(2, '0');
    final ss = (left.inSeconds % 60).toString().padLeft(2, '0');
    return Text(l10n.homeOrdersDeadline('$mm:$ss'),
        style: theme.textTheme.bodyMedium);
  }
}
