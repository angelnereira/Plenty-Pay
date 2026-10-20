import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';

/// S-GEN-21 · Confirmación fuerte (C-06), hoja inferior modal.
///
/// e1 "Confirma que eres tú" · e2 la operación y su monto · e5 "Cancelar" (la operación no se
/// envía). Quien llama pide después el reto y el token a identity (`/v1/step-up/*`), atados a la
/// operación y al monto; el servidor es quien decide. El factor (e3 biometría local, e4 PIN) no se
/// simula en la app: llega con passkeys o el PIN verificado por identity (Q-38, F23.3, F28).
class StepUpDialog extends StatelessWidget {
  const StepUpDialog({
    super.key,
    required this.operationTitle,
    this.amountMinor,
    this.operationDescription,
  });

  final String operationTitle;
  final int? amountMinor;
  final String? operationDescription;

  /// true si la persona confirma; false si cancela o cierra la hoja.
  static Future<bool> confirm(
    BuildContext context, {
    required String title,
    int? amountMinor,
    String? description,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => StepUpDialog(
        operationTitle: title,
        amountMinor: amountMinor,
        operationDescription: description,
      ),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(margin, 0, margin, AppTokens.spacingLg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Icon(Icons.lock_person_outlined,
                  color: theme.colorScheme.primary),
              const SizedBox(width: AppTokens.spacingSm),
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(l10n.stepUpTitle,
                      style: theme.textTheme.titleLarge),
                ),
              ),
            ]),
            const SizedBox(height: AppTokens.spacingMd),
            Text(operationTitle, style: theme.textTheme.bodyLarge),
            if (amountMinor != null)
              MoneyText(amountMinor!,
                  style: theme.textTheme.headlineMedium
                      ?.copyWith(color: theme.colorScheme.primary)),
            if (operationDescription != null) ...[
              const SizedBox(height: AppTokens.spacingSm),
              Text(operationDescription!, style: theme.textTheme.bodyMedium),
            ],
            const SizedBox(height: AppTokens.spacingLg),
            PPButton.primary(
                label: l10n.stepUpConfirm,
                onPressed: () => Navigator.of(context).pop(true)),
            const SizedBox(height: AppTokens.spacingSm),
            PPButton.text(
                label: l10n.actionCancel,
                onPressed: () => Navigator.of(context).pop(false)),
          ],
        ),
      ),
    );
  }
}
