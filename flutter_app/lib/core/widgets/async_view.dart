import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'pp_button.dart';

/// Muestra los cuatro estados de una carga (design-system.md §1 principio 4):
/// cargando (esqueleto), error (con reintentar), vacío y datos. Nunca una pantalla en blanco.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.snapshot,
    required this.builder,
    required this.errorMessage,
    required this.retryLabel,
    required this.onRetry,
    required this.emptyView,
    this.isEmpty,
  });

  final AsyncSnapshot<T> snapshot;
  final Widget Function(BuildContext context, T data) builder;
  final String errorMessage;
  final String retryLabel;
  final VoidCallback onRetry;
  final Widget emptyView;

  /// Indica si los datos cargados cuentan como vacíos (p. ej. lista sin elementos).
  final bool Function(T data)? isEmpty;

  @override
  Widget build(BuildContext context) {
    if (snapshot.hasError) {
      return _ErrorState(message: errorMessage, retryLabel: retryLabel, onRetry: onRetry);
    }
    if (snapshot.connectionState != ConnectionState.done && !snapshot.hasData) {
      return const _Skeleton();
    }
    if (!snapshot.hasData) return emptyView;
    final data = snapshot.requireData;
    if (isEmpty?.call(data) ?? false) return emptyView;
    return builder(context, data);
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    Widget bar(double height) => Container(
          height: height,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(Tokens.radius)),
        );
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        bar(56),
        const SizedBox(height: 12),
        bar(56),
        const SizedBox(height: 12),
        bar(56),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.retryLabel, required this.onRetry});

  final String message;
  final String retryLabel;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline, size: 40, color: scheme.error),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 16),
        PPButton.secondary(label: retryLabel, onPressed: onRetry),
      ],
    );
  }
}
