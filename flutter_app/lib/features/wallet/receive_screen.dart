import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import 'feature_unavailable.dart';

/// S-WAL-04 · Recibir. El QR personal sirve para transferencias entre personas (T4), que aún no
/// existen: la pantalla no muestra un código que nadie podría pagar.
class ReceiveScreen extends StatelessWidget {
  const ReceiveScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FeatureUnavailableScreen(
        title: l10n.walletReceive,
        message: l10n.receiveUnavailable,
        icon: Icons.qr_code_2);
  }
}
