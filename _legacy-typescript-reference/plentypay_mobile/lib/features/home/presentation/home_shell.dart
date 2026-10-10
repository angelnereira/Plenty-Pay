import 'package:flutter/material.dart';

import '../../../app_dependencies.dart';
import '../../catalog/presentation/catalog_screen.dart';
import '../../nfc_pay/presentation/nfc_pay_screen.dart';
import '../../wallet/presentation/wallet_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.dependencies, required this.onLogout});
  final AppDependencies dependencies;
  final Future<void> Function() onLogout;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final deps = widget.dependencies;
    final pages = <Widget>[
      WalletScreen(walletRepository: deps.walletRepository),
      CatalogScreen(catalogRepository: deps.catalogRepository),
      NfcPayScreen(
        paymentRepository: deps.paymentRepository,
        nfcTagService: deps.nfcTagService,
        biometricService: deps.biometricService,
      ),
      _AccountPage(onLogout: widget.onLogout),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Wallet'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), label: 'Catálogo'),
          NavigationDestination(icon: Icon(Icons.nfc_rounded), label: 'Pagos'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), label: 'Cuenta'),
        ],
      ),
    );
  }
}

class _AccountPage extends StatelessWidget {
  const _AccountPage({required this.onLogout});
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cuenta')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.logout_rounded),
            title: const Text('Cerrar sesión'),
            onTap: onLogout,
          ),
        ],
      ),
    );
  }
}
