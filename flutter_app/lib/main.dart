import 'package:flutter/material.dart';

import 'core/api/api_client.dart';
import 'core/config/app_config.dart';
import 'core/l10n/generated/app_localizations.dart';
import 'core/l10n/locales.dart';
import 'core/session/session_store.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/app_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Falla al arrancar si el flavor exige https y la URL no lo es (flutter-standards.md §5.1).
  final config = AppConfig.fromEnvironment();
  final session = SessionStore();
  final signedIn = await session.accessToken() != null;
  runApp(PlentyPayApp(
    api: ApiClient(baseUrl: config.apiBaseUrl, session: session),
    startSignedIn: signedIn,
  ));
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
      // F02.6: reemplazar por go_router con redirect global (flutter-standards.md §6).
      home: _signedIn
          ? AppShell(api: widget.api, onSignedOut: () => setState(() => _signedIn = false))
          : LoginScreen(api: widget.api, onSignedIn: () => setState(() => _signedIn = true)),
    );
  }
}
