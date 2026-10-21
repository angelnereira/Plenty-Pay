import 'package:flutter/widgets.dart';

import '../../core/api/api_client.dart';
import '../auth/step_up_dialog.dart';

/// Ejecuta [run] sin token; si identity responde `STEP_UP_REQUIRED`, muestra la confirmación
/// fuerte (S-GEN-21), que obtiene de identity un token para [operation], y reintenta una sola vez.
/// Devuelve null si la persona cancela la confirmación.
Future<T?> runWithStepUp<T>(
  BuildContext context, {
  required ApiClient api,
  required String operation,
  required String title,
  required Future<T> Function(String? stepUpToken) run,
}) async {
  try {
    return await run(null);
  } on ApiException catch (e) {
    if (e.reason != 'STEP_UP_REQUIRED' || !context.mounted) rethrow;
  }
  // S-GEN-21 pide el reto y verifica el PIN o la contraseña en identity (ADR 0020).
  final token = await StepUpDialog.obtainToken(context,
      api: api, operation: operation, title: title);
  if (token == null) return null;
  return run(token);
}
