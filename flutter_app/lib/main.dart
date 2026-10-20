import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'core/api/api_client.dart';
import 'core/config/app_config.dart';
import 'core/config/server_discovery.dart';
import 'core/l10n/generated/app_localizations.dart';
import 'core/l10n/locales.dart';
import 'core/observability/app_logger.dart';
import 'core/session/session_store.dart';
import 'core/sync/deep_links.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'features/auth/login_screen.dart';
import 'features/invitations/accept_invitation_screen.dart';
import 'features/shell/app_shell.dart';

/// Versión del build (`--dart-define=BUILD_ID=...`); identifica los símbolos para des-ofuscar las pilas.
const String _buildId = String.fromEnvironment('BUILD_ID', defaultValue: 'dev');

void main() {
  // Cola acotada para el exportador (F22.6) + consola en desarrollo.
  final logger = AppLogger(
    sinks: [QueueSink(), if (kDebugMode) const ConsoleSink()],
    buildId: _buildId,
    environment: const String.fromEnvironment('FLAVOR', defaultValue: 'dev'),
  );
  // Las tres capturas globales (observability-standards.md §13.1); todo el arranque corre dentro.
  runGuarded(logger, () async {
    WidgetsFlutterBinding.ensureInitialized();
    // Falla al arrancar si el flavor exige https y la URL no lo es (flutter-standards.md §5.1).
    final config = AppConfig.fromEnvironment();
    final session = SessionStore();
    // La URL manual es solo para servidores de desarrollo; un túnel rápido viejo guardado ahí
    // dejaría la app sin servidor (ADR 0019 §6).
    final customUrl = await session.customBaseUrl();
    if (customUrl != null &&
        (customUrl.contains('localhost') ||
            customUrl.contains('127.0.0.1') ||
            customUrl.contains('10.0.2.2') ||
            isEphemeralTunnel(customUrl))) {
      await session.clearCustomBaseUrl();
    }
    final manualUrl = await session.customBaseUrl();
    final discovery =
        ServerDiscovery(flavor: config.flavor.name, logger: logger);
    Future<String?> discover() async {
      final url = await discovery.discover();
      if (url != null) await session.saveDiscoveredBaseUrl(url);
      return url;
    }

    final hasManual = manualUrl != null && manualUrl.isNotEmpty;
    final effectiveUrl = resolveBaseUrl(
      manual: manualUrl,
      discovered: hasManual ? null : await discover(),
      lastDiscovered: await session.discoveredBaseUrl(),
      built: config.apiBaseUrl,
    );
    final signedIn = await session.accessToken() != null;
    logger.info('app started');
    runApp(PlentyPayApp(
      api: ApiClient(
          baseUrl: effectiveUrl,
          session: session,
          logger: logger,
          rediscover: hasManual ? null : discover),
      startSignedIn: signedIn,
    ));
  });
}

class PlentyPayApp extends StatefulWidget {
  const PlentyPayApp(
      {super.key, required this.api, required this.startSignedIn, this.locale});
  final ApiClient api;
  final bool startSignedIn;

  /// Fuerza un idioma (pruebas); null = el del dispositivo.
  final Locale? locale;

  @override
  State<PlentyPayApp> createState() => _PlentyPayAppState();
}

class _PlentyPayAppState extends State<PlentyPayApp> {
  late bool _signedIn = widget.startSignedIn;

  /// S-GEN-17: en la web, el enlace del correo abre la app en `/invite/<token>` (el origen es el
  /// propio despliegue, así que basta la ruta). En Android/iOS el enlace nativo llega con F22.3.
  String? _inviteToken = kIsWeb ? inviteTokenFromPath(Uri.base) : null;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ThemeController.instance,
      builder: (context, _) => MaterialApp(
        onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
        debugShowCheckedModeBanner: false,
        locale: widget.locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: appSupportedLocales,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: ThemeController.instance.mode,
        navigatorObservers: [TelemetryNavigatorObserver(widget.api.logger)],
        // F02.6: reemplazar por go_router con redirect global (flutter-standards.md §6).
        home: _inviteToken != null
            ? AcceptInvitationScreen(
                api: widget.api,
                token: _inviteToken!,
                onAccepted: () => setState(() {
                  _inviteToken = null;
                  _signedIn = true;
                }),
              )
            : _signedIn
                ? AppShell(
                    api: widget.api,
                    onSignedOut: () => setState(() => _signedIn = false))
                : LoginScreen(
                    api: widget.api,
                    onSignedIn: () => setState(() => _signedIn = true)),
      ),
    );
  }
}
