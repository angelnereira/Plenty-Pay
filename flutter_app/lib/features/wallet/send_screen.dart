import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import 'feature_unavailable.dart';

/// S-WAL-03 · `/wallet/send` · Enviar dinero. Las transferencias entre personas (T4,
/// `POST /v1/wallet/transfers`) aún no existen en payments-core: la pantalla lo dice.
class SendScreen extends StatelessWidget {
  const SendScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FeatureUnavailableScreen(
        title: l10n.sendTitle,
        message: l10n.sendUnavailable,
        icon: Icons.send_outlined);
  }
}
