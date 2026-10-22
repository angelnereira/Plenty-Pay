import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import 'pay_data.dart' show payErrorMessage;
import 'wallet_data.dart';

/// Código personal para recibir (payments.ReceiveCode).
class ReceiveCodeItem {
  const ReceiveCodeItem(
      {required this.code,
      required this.link,
      required this.displayName,
      required this.expiresAt});

  factory ReceiveCodeItem.fromJson(Map<String, dynamic> j) => ReceiveCodeItem(
        code: j['code'] as String? ?? '',
        link: j['link'] as String? ?? '',
        displayName: j['display_name'] as String? ?? '',
        expiresAt:
            DateTime.tryParse(j['expires_at'] as String? ?? '')?.toLocal(),
      );

  final String code;
  final String link;
  final String displayName;
  final DateTime? expiresAt;

  /// S-WAL-04 e3: con monto, el QR lo lleva (`?amount=<centavos>`); quien paga no lo cambia.
  String linkFor(int? amountMinor) => amountMinor == null || amountMinor <= 0
      ? link
      : '$link?amount=$amountMinor';
}

/// S-WAL-04 · `/wallet/receive` · Recibir (F11.10). `wallet:read`.
///
/// e1 QR con el enlace del código personal (vence a las 24 h; pedirlo de nuevo lo renueva),
/// e2 nombre como lo verá quien envía, e3 monto opcional que viaja en el QR, e4 copiar enlace.
/// El QR solo lleva el código: identifica a la persona en el servidor sin mostrar su correo ni su
/// teléfono. Mientras el dominio no exista (Q-53), solo lo lee la app PlentyPay.
class ReceiveScreen extends StatefulWidget {
  const ReceiveScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<ReceiveScreen> createState() => _ReceiveScreenState();
}

class _ReceiveScreenState extends State<ReceiveScreen> {
  late Future<ReceiveCodeItem> _future = _load();
  final _amount = TextEditingController();

  Future<ReceiveCodeItem> _load() async =>
      ReceiveCodeItem.fromJson(await widget.api.receiveCode());

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.walletReceive)),
      body: FutureBuilder<ReceiveCodeItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
          children: [
            AsyncView<ReceiveCodeItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? payErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, rc) => _body(context, rc),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context, ReceiveCodeItem rc) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final amount = MoneyText.parse(_amount.text);
    final invalid = _amount.text.trim().isNotEmpty && (amount ?? 0) <= 0;
    final link = rc.linkFor(invalid ? null : amount);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // e1
      Center(
        child: Container(
          padding: const EdgeInsets.all(AppTokens.spacingMd),
          decoration: BoxDecoration(
            // El QR necesita fondo claro y módulos oscuros en cualquier tema para leerse.
            color: Tokens.lightSurface,
            borderRadius: BorderRadius.circular(AppTokens.radiusLg),
          ),
          child: QrImageView(
            // La clave es el contenido: el QR cambia (y se puede verificar) cuando cambia el monto.
            key: ValueKey(link),
            data: link,
            size: AppTokens.spacingXl * 8,
            eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square, color: Tokens.lightText),
            dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Tokens.lightText),
            semanticsLabel: l10n.receiveScanToSend,
          ),
        ),
      ),
      const SizedBox(height: AppTokens.spacingSm),
      // e2
      Text(rc.displayName,
          textAlign: TextAlign.center, style: theme.textTheme.titleLarge),
      Text(l10n.receiveHint,
          textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
      if (rc.expiresAt != null)
        Text(l10n.receiveValidUntil(walletDateTime(rc.expiresAt!, locale)),
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      const SizedBox(height: AppTokens.spacingLg),
      // e3
      TextField(
        controller: _amount,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(
          labelText: l10n.receiveAmount,
          prefixText: r'$ ',
          errorText: invalid ? l10n.payAmountInvalid : null,
        ),
      ),
      const SizedBox(height: AppTokens.spacingMd),
      // e4
      PPButton.secondary(
        label: l10n.terminalCopyLink,
        onPressed: () async {
          await Clipboard.setData(ClipboardData(text: link));
          if (!context.mounted) return;
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.terminalLinkCopied)));
        },
      ),
      const SizedBox(height: AppTokens.spacingSm),
      Text(l10n.receiveAppOnly,
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
    ]);
  }
}
