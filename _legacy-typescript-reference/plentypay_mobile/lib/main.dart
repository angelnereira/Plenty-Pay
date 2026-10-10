import 'package:flutter/material.dart';

import 'app_dependencies.dart';
import 'core/theme/plentypay_theme.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/home/presentation/home_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(PlentyPayApp(dependencies: AppDependencies.create()));
}

class PlentyPayApp extends StatefulWidget {
  const PlentyPayApp({super.key, required this.dependencies});
  final AppDependencies dependencies;

  @override
  State<PlentyPayApp> createState() => _PlentyPayAppState();
}

class _PlentyPayAppState extends State<PlentyPayApp> {
  bool? _loggedIn; // null = todavía comprobando si hay sesión guardada

  @override
  void initState() {
    super.initState();
    widget.dependencies.authRepository.hasActiveSession().then((value) {
      if (mounted) setState(() => _loggedIn = value);
    });
  }

  Future<void> _logout() async {
    await widget.dependencies.authRepository.logout();
    if (mounted) setState(() => _loggedIn = false);
  }

  @override
  Widget build(BuildContext context) {
    final Widget home;
    if (_loggedIn == null) {
      home = const Scaffold(body: Center(child: CircularProgressIndicator()));
    } else if (_loggedIn == false) {
      home = LoginScreen(
        authRepository: widget.dependencies.authRepository,
        onLoggedIn: () => setState(() => _loggedIn = true),
      );
    } else {
      home = HomeShell(dependencies: widget.dependencies, onLogout: _logout);
    }

    return MaterialApp(
      title: 'PlentyPay',
      debugShowCheckedModeBanner: false,
      theme: PlentyPayTheme.light(),
      darkTheme: PlentyPayTheme.dark(),
      home: home,
    );
  }
}
