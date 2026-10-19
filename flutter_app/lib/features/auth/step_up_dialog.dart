import 'package:flutter/material.dart';

import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';

/// S-GEN-21 · Diálogo de confirmación fuerte (Step-up authentication).
///
/// Exigido para operaciones sensibles (monto ≥ umbral, cambio de destino de fondos,
/// aprobaciones de nómina, reembolsos). F05.6 / F23.3.
class StepUpDialog extends StatefulWidget {
  const StepUpDialog({
    super.key,
    required this.operationTitle,
    this.amountMinor,
    this.operationDescription,
  });

  final String operationTitle;
  final int? amountMinor;
  final String? operationDescription;

  static Future<bool> confirm(
    BuildContext context, {
    required String title,
    int? amountMinor,
    String? description,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StepUpDialog(
        operationTitle: title,
        amountMinor: amountMinor,
        operationDescription: description,
      ),
    );
    return result ?? false;
  }

  @override
  State<StepUpDialog> createState() => _StepUpDialogState();
}

class _StepUpDialogState extends State<StepUpDialog> {
  final _pinController = TextEditingController();
  bool _verifying = false;
  String? _error;

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_pinController.text.length < 4) return;
    setState(() {
      _verifying = true;
      _error = null;
    });

    await Future<void>.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    if (_pinController.text == '0000') {
      setState(() {
        _verifying = false;
        _error = 'PIN incorrecto. Inténtalo de nuevo.';
      });
      return;
    }

    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return AlertDialog(
      title: Row(
        children: [
          Icon(Icons.lock_person_outlined, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          Expanded(child: Text(widget.operationTitle, style: theme.textTheme.titleMedium)),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.amountMinor != null) ...[
              Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: MoneyText(
                    widget.amountMinor!,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (widget.operationDescription != null) ...[
              Text(widget.operationDescription!, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 16),
            ],
            Text(
              'Por seguridad, confirma tu PIN o huella para autorizar esta operación:',
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            PPTextField(
              controller: _pinController,
              labelText: 'PIN de seguridad',
              obscureText: true,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: theme.colorScheme.error, fontSize: 12)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        PPButton.primary(
          label: 'Confirmar',
          onPressed: _pinController.text.length >= 4 && !_verifying ? _verify : null,
        ),
      ],
    );
  }
}
