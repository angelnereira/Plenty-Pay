import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/pay/qr_scanner.dart';
import '../../core/theme/tokens.dart';
import '../../core/widgets/pp_button.dart';
import 'pay_confirm_screen.dart';

/// S-WAL-05 · `/pay/scan` · Pagar: escanear o escribir el código. Permiso `wallet:pay`.
///
/// Solo acepta `https://<host permitido>/t/<code>` (flutter-standards §10.1, `parsePaymentQr`).
/// El contenido del QR nunca se muestra como verdad: el código viaja al servidor y S-WAL-06
/// muestra el comercio verificado. NFC (e2) llega en F23.2.
class PayScanScreen extends StatefulWidget {
  const PayScanScreen({super.key, required this.api, this.startScanner = true});
  final ApiClient api;

  /// Falso en pruebas de widget (sin cámara).
  final bool startScanner;

  @override
  State<PayScanScreen> createState() => _PayScanScreenState();
}

class _PayScanScreenState extends State<PayScanScreen> {
  MobileScannerController? _scanner;
  bool _cameraDenied = false;
  bool _opening = false;
  bool _torch = false;
  final _code = TextEditingController();
  String? _codeError;

  @override
  void initState() {
    super.initState();
    if (widget.startScanner) _startScanner();
  }

  Future<void> _startScanner() async {
    if (!kIsWeb) {
      final status = await Permission.camera.request();
      if (!status.isGranted) {
        widget.api.logger.breadcrumb('ui', 'pay.scan.camera', status.name);
        if (mounted) setState(() => _cameraDenied = true);
        return;
      }
    }
    if (!mounted) return;
    setState(() => _scanner = MobileScannerController(
        detectionSpeed: DetectionSpeed.noDuplicates,
        formats: [BarcodeFormat.qrCode]));
  }

  @override
  void dispose() {
    _scanner?.dispose();
    _code.dispose();
    super.dispose();
  }

  String _rejection(AppLocalizations l10n, QrRejection r) => switch (r) {
        QrRejection.hostNotAllowed ||
        QrRejection.notAPaymentLink =>
          l10n.payNotPlentyPay,
        QrRejection.invalidCode || QrRejection.malformed => l10n.payInvalidCode,
      };

  Future<void> _open(String code, {String? saleId, int? amountMinor}) async {
    if (_opening) return;
    _opening = true;
    await _scanner?.stop();
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => PayConfirmScreen(
            api: widget.api,
            code: code,
            saleId: saleId,
            amountMinor: amountMinor)));
    _opening = false;
    await _scanner?.start();
  }

  void _onScanned(String raw) {
    final l10n = AppLocalizations.of(context);
    final result = parsePaymentQr(raw);
    if (result.isAccepted) {
      final link = result.link!;
      _open(link.code, saleId: link.saleId, amountMinor: link.amountMinor);
    } else {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
            SnackBar(content: Text(_rejection(l10n, result.rejection!))));
    }
  }

  void _onTypedCode() {
    final l10n = AppLocalizations.of(context);
    final code = _code.text.trim();
    if (!paymentCodePattern.hasMatch(code)) {
      setState(() => _codeError = l10n.payInvalidCode);
      return;
    }
    setState(() => _codeError = null);
    _open(code);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final margin = WindowClass.of(context).horizontalMargin;
    final scanner = _scanner;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.walletPay), actions: [
        if (scanner != null)
          IconButton(
            tooltip: l10n.payTorch,
            icon: Icon(_torch ? Icons.flash_on : Icons.flash_off),
            onPressed: () async {
              await scanner.toggleTorch();
              if (mounted) setState(() => _torch = !_torch);
            },
          ),
      ]),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            margin, AppTokens.spacingMd, margin, AppTokens.spacingLg),
        children: [
          // Visor cuadrado y acotado: en pantallas anchas no empuja el campo del código.
          Center(
            child: ConstrainedBox(
              constraints:
                  const BoxConstraints(maxWidth: AppTokens.spacingXl * 12),
              child: AspectRatio(
                aspectRatio: 1,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppTokens.radiusLg),
                  child: ColoredBox(
                    color: theme.colorScheme.surfaceContainerHighest,
                    child: scanner != null
                        ? MobileScanner(
                            controller: scanner,
                            onDetect: (capture) {
                              for (final b in capture.barcodes) {
                                final raw = b.rawValue;
                                if (raw != null && raw.isNotEmpty) {
                                  _onScanned(raw);
                                  return;
                                }
                              }
                            },
                            errorBuilder: (context, error) {
                              widget.api.logger.breadcrumb('ui',
                                  'pay.scan.camera', error.errorCode.name);
                              return _CameraMessage(
                                  text: l10n.payCameraUnavailable);
                            },
                          )
                        : _CameraMessage(
                            text: l10n.payCameraUnavailable,
                            action: _cameraDenied && !kIsWeb
                                ? PPButton.secondary(
                                    label: l10n.payOpenSettings,
                                    onPressed: openAppSettings)
                                : null),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppTokens.spacingSm),
          Text(l10n.payScanHint,
              textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
          const SizedBox(height: AppTokens.spacingLg),
          Text(l10n.payEnterCode, style: theme.textTheme.titleSmall),
          const SizedBox(height: AppTokens.spacingSm),
          TextField(
            controller: _code,
            decoration: InputDecoration(
                labelText: l10n.payCodeLabel, errorText: _codeError),
            autocorrect: false,
            textInputAction: TextInputAction.go,
            onSubmitted: (_) => _onTypedCode(),
          ),
          const SizedBox(height: AppTokens.spacingMd),
          PPButton.primary(label: l10n.actionContinue, onPressed: _onTypedCode),
        ],
      ),
    );
  }
}

class _CameraMessage extends StatelessWidget {
  const _CameraMessage({required this.text, this.action});
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacingMd),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.videocam_off_outlined,
              color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: AppTokens.spacingSm),
          Text(text,
              textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
          if (action != null) ...[
            const SizedBox(height: AppTokens.spacingMd),
            action!
          ],
        ]),
      ),
    );
  }
}
