import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'core/api/api_client.dart';
import 'core/config/app_config.dart';
import 'core/l10n/generated/app_localizations.dart';
import 'core/l10n/locales.dart';
import 'core/observability/app_logger.dart';
import 'core/session/session_store.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
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
    final customUrl = await session.customBaseUrl();
    final effectiveUrl = (customUrl != null && customUrl.isNotEmpty) ? customUrl : config.apiBaseUrl;
    final signedIn = await session.accessToken() != null;
    logger.info('app started');
    runApp(PlentyPayApp(
      api: ApiClient(baseUrl: effectiveUrl, session: session, logger: logger),
      startSignedIn: signedIn,
    ));
  });
}

class PlentyPayApp extends StatefulWidget {
  const PlentyPayApp({super.key, required this.api, required this.startSignedIn, this.locale});
  final ApiClient api;
  final bool startSignedIn;

  /// Fuerza un idioma (pruebas); null = el del dispositivo.
  final Locale? locale;

  @override
  State<PlentyPayApp> createState() => _PlentyPayAppState();
}

class _PlentyPayAppState extends State<PlentyPayApp> {
  late bool _signedIn = widget.startSignedIn;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      locale: widget.locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: appSupportedLocales,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      navigatorObservers: [TelemetryNavigatorObserver(widget.api.logger)],
      // F02.6: reemplazar por go_router con redirect global (flutter-standards.md §6).
      home: _signedIn
          ? AppShell(api: widget.api, onSignedOut: () => setState(() => _signedIn = false))
          : LoginScreen(api: widget.api, onSignedIn: () => setState(() => _signedIn = true)),
    );
  }
}
