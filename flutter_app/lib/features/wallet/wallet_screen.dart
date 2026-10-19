import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import 'topup_screen.dart';
import 'send_screen.dart';
import 'receive_screen.dart';
import 'pay_scan_screen.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.walletTitle)),
      body: ListView(
        children: [
          ListTile(leading: const Icon(Icons.add), title: Text(l10n.topupTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => TopupScreen(api: api)))),
          ListTile(leading: const Icon(Icons.send), title: Text(l10n.sendTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SendScreen(api: api)))),
          ListTile(leading: const Icon(Icons.qr_code), title: const Text('Recibir'), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ReceiveScreen(api: api)))),
          ListTile(leading: const Icon(Icons.qr_code_scanner), title: Text(l10n.payQrTitle), trailing: const Icon(Icons.chevron_right), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PayScanScreen(api: api)))),
        ],
      ),
    );
  }
}
