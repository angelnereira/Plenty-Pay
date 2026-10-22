import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import 'pay_scan_screen.dart';

/// S-WAL-03 · `/wallet/send` · Enviar dinero (F11.10). `wallet:transfer`.
///
/// Se envía escaneando el QR personal de quien recibe (S-WAL-04) o escribiendo su código; la
/// persona se verifica en el servidor antes de confirmar. Buscar por correo o teléfono espera
/// Q-54 (directorio de personas).
class SendScreen extends StatelessWidget {
  const SendScreen({super.key, required this.api, this.startScanner = true});
  final ApiClient api;

  /// Falso en pruebas de widget (sin cámara).
  final bool startScanner;

  @override
  Widget build(BuildContext context) =>
      PayScanScreen(api: api, send: true, startScanner: startScanner);
}
