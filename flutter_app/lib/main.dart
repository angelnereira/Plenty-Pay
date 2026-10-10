import 'package:flutter/material.dart';

import 'core/api/api_client.dart';
import 'core/config.dart';
import 'core/session/session_store.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/app_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.assertSecure();
  final session = SessionStore();
  final signedIn = await session.accessToken() != null;
  runApp(PlentyPayApp(api: ApiClient(session: session), startSignedIn: signedIn));
}

class PlentyPayApp extends StatefulWidget {
  const PlentyPayApp({super.key, required this.api, required this.startSignedIn});
  final ApiClient api;
  final bool startSignedIn;

  @override
  State<PlentyPayApp> createState() => _PlentyPayAppState();
}

class _PlentyPayAppState extends State<PlentyPayApp> {
  late bool _signedIn = widget.startSignedIn;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PlentyPay',
      debugShowCheckedModeBanner: false,
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
