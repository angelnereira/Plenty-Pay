import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import 'feature_unavailable.dart';

/// S-WAL-02 · `/wallet/topup` · Recargar. La recarga necesita un riel externo (T1); su adaptador
/// sandbox llega en F11.7. Hasta entonces la pantalla lo dice: nunca confirma una recarga que no
/// ocurrió.
class TopupScreen extends StatelessWidget {
  const TopupScreen({super.key, required this.api});
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FeatureUnavailableScreen(
        title: l10n.topupTitle,
        message: l10n.topupUnavailable,
        icon: Icons.add_card_outlined);
  }
}
