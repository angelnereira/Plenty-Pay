import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';

/// Estado vacío de una función de dinero cuyo servicio aún no existe (AGENTS.md §3.1): se dice
/// con claridad en vez de simular un resultado.
class FeatureUnavailableScreen extends StatelessWidget {
  const FeatureUnavailableScreen(
      {super.key,
      required this.title,
      required this.message,
      this.icon = Icons.schedule});

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
                horizontal: margin, vertical: AppTokens.spacingLg),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon,
                  size: AppTokens.spacingXl * 2,
                  color: theme.colorScheme.onSurfaceVariant),
              const SizedBox(height: AppTokens.spacingMd),
              Text(l10n.featureUnavailableTitle,
                  style: theme.textTheme.titleLarge,
                  textAlign: TextAlign.center),
              const SizedBox(height: AppTokens.spacingSm),
              Text(message,
                  style: theme.textTheme.bodyLarge,
                  textAlign: TextAlign.center),
              const SizedBox(height: AppTokens.spacingLg),
              PPButton.secondary(
                  label: l10n.actionClose,
                  onPressed: () => Navigator.of(context).maybePop()),
            ]),
          ),
        ),
      ),
    );
  }
}
