// ─────────────────────────────────────────────────────────────────────────────
// NFC como CANAL DE INICIO de pago (tags NDEF) — no aceptación EMV contactless.
//
// Qué hace: el comercio programa un tag NFC con un enlace https opaco
//   https://<PAYMENT_LINK_HOST>/t/<terminalCode>
// y el cliente lo toca con su teléfono; la app abre el flujo de pago y este se
// liquida por los rieles normales (wallet, Yappy, tarjeta vía PSP).
//
// Qué NO hace: aceptar el "tap" de una tarjeta Visa/Mastercard/Apple Pay/Google
// Pay. Eso es Tap to Pay/SoftPOS y exige el SDK de un PSP certificado.
//
// SEGURIDAD (léelo antes de tocar este archivo):
//  • Un tag NDEF se puede regrabar o tapar con otro sticker. Por eso el tag
//    lleva SOLO un código opaco de terminal — nunca monto ni destinatario — y el
//    servidor resuelve a qué comercio pertenece. La pantalla de confirmación
//    muestra ese nombre verificado por el servidor y exige biometría.
//  • Este parser rechaza cualquier URI que no sea https, del host configurado y
//    con la forma /t/<código>. Un tag con otro host se ignora.
//  • Operativo: proteger contra escritura los tags ya programados (lock bits)
//    con la herramienta del fabricante; nfc_manager no lo hace de forma portable.
//
// Escrito contra nfc_manager 4.x (NdefAndroid/NdefIos + ndef_record 1.0.x).
// NO se compiló en el entorno donde se generó (sin SDK de Flutter): si tu
// versión cambió la API, este es el ÚNICO archivo que hay que ajustar.
// ─────────────────────────────────────────────────────────────────────────────
import 'dart:convert';
import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:ndef_record/ndef_record.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/nfc_manager_android.dart';
import 'package:nfc_manager/nfc_manager_ios.dart';

import '../../../core/config/app_config.dart';

class PaymentTagPayload {
  const PaymentTagPayload({required this.terminalCode});
  final String terminalCode;
}

class NfcTagService {
  static final _terminalCodePattern = RegExp(r'^[A-Za-z0-9_-]{8,64}$');

  // Prefijos de la especificación NFC Forum URI RTD que soportamos. Cualquier otro → se rechaza.
  static const _uriPrefixes = <int, String>{
    0x00: '',
    0x01: 'http://www.',
    0x02: 'https://www.',
    0x03: 'http://',
    0x04: 'https://',
  };

  bool get isPlatformSupported => Platform.isAndroid || Platform.isIOS;

  Future<bool> isAvailable() async {
    if (!isPlatformSupported) return false;
    try {
      return await NfcManager.instance.checkAvailability() == NfcAvailability.enabled;
    } on Exception {
      return false;
    }
  }

  /// Espera un tag y devuelve el código de terminal si el tag es un tag de pago válido de PlentyPay.
  Future<void> startReading({
    required void Function(PaymentTagPayload payload) onPaymentTag,
    required void Function(String message) onError,
  }) async {
    if (!await isAvailable()) {
      onError('NFC no está disponible o está desactivado en este dispositivo.');
      return;
    }
    await NfcManager.instance.startSession(
      pollingOptions: {NfcPollingOption.iso14443},
      alertMessageIos: 'Acerca el teléfono al tag de pago del comercio',
      onDiscovered: (tag) async {
        try {
          final message = await _readNdefMessage(tag);
          final payload = message == null ? null : parsePaymentMessage(message);
          await NfcManager.instance.stopSession();
          if (payload == null) {
            onError('Este tag no es un tag de pago válido de PlentyPay.');
          } else {
            onPaymentTag(payload);
          }
        } on Exception catch (e) {
          await NfcManager.instance.stopSession();
          onError('No se pudo leer el tag: $e');
        }
      },
    );
  }

  /// Programa un tag con el enlace de pago de una terminal (uso del comercio).
  Future<void> writeTerminalTag({
    required String terminalCode,
    required void Function() onWritten,
    required void Function(String message) onError,
  }) async {
    if (!_terminalCodePattern.hasMatch(terminalCode)) {
      onError('Código de terminal inválido.');
      return;
    }
    if (!await isAvailable()) {
      onError('NFC no está disponible o está desactivado en este dispositivo.');
      return;
    }
    final message = buildPaymentMessage(terminalCode);
    await NfcManager.instance.startSession(
      pollingOptions: {NfcPollingOption.iso14443},
      alertMessageIos: 'Acerca el tag que quieres programar',
      onDiscovered: (tag) async {
        try {
          await _writeNdefMessage(tag, message);
          await NfcManager.instance.stopSession();
          onWritten();
        } on Exception catch (e) {
          await NfcManager.instance.stopSession();
          onError('No se pudo escribir el tag: $e');
        }
      },
    );
  }

  Future<void> stop() async {
    try {
      await NfcManager.instance.stopSession();
    } on Exception {
      // sesión ya cerrada
    }
  }

  // ── NDEF: construir / parsear el enlace de pago ───────────────────────────

  /// NdefMessage con un único record URI (RTD 'U'): prefijo 0x04 ("https://") + resto del enlace.
  NdefMessage buildPaymentMessage(String terminalCode) {
    final rest = '${AppConfig.paymentLinkHost}/t/$terminalCode';
    return NdefMessage(records: [
      NdefRecord(
        typeNameFormat: TypeNameFormat.wellKnown,
        type: Uint8List.fromList([0x55]),
        identifier: Uint8List(0),
        payload: Uint8List.fromList([0x04, ...utf8.encode(rest)]),
      ),
    ]);
  }

  /// Devuelve el payload solo si el PRIMER record es un URI https del host configurado con la forma /t/<código>.
  PaymentTagPayload? parsePaymentMessage(NdefMessage message) {
    if (message.records.isEmpty) return null;
    final record = message.records.first;
    final isUriRecord = record.typeNameFormat == TypeNameFormat.wellKnown &&
        record.type.length == 1 &&
        record.type[0] == 0x55;
    if (!isUriRecord || record.payload.isEmpty) return null;

    final prefix = _uriPrefixes[record.payload[0]];
    if (prefix == null) return null;

    final Uri? uri;
    try {
      uri = Uri.tryParse('$prefix${utf8.decode(record.payload.sublist(1))}');
    } on FormatException {
      return null;
    }
    if (uri == null || uri.scheme != 'https' || uri.host != AppConfig.paymentLinkHost) return null;
    final segments = uri.pathSegments;
    if (segments.length != 2 || segments[0] != 't') return null;
    if (!_terminalCodePattern.hasMatch(segments[1])) return null;

    return PaymentTagPayload(terminalCode: segments[1]);
  }

  /// Extrae el código de terminal de un enlace https (usado también para QR).
  PaymentTagPayload? parsePaymentLink(String link) {
    final uri = Uri.tryParse(link.trim());
    if (uri == null || uri.scheme != 'https' || uri.host != AppConfig.paymentLinkHost) return null;
    final segments = uri.pathSegments;
    if (segments.length != 2 || segments[0] != 't' || !_terminalCodePattern.hasMatch(segments[1])) return null;
    return PaymentTagPayload(terminalCode: segments[1]);
  }

  String buildPaymentLink(String terminalCode) => 'https://${AppConfig.paymentLinkHost}/t/$terminalCode';

  // ── Acceso NDEF por plataforma (API de nfc_manager 4.x) ───────────────────

  Future<NdefMessage?> _readNdefMessage(NfcTag tag) async {
    if (Platform.isAndroid) {
      final ndef = NdefAndroid.from(tag);
      if (ndef == null) return null;
      return ndef.cachedNdefMessage ?? await ndef.getNdefMessage();
    }
    if (Platform.isIOS) {
      final ndef = NdefIos.from(tag);
      if (ndef == null) return null;
      return ndef.cachedNdefMessage ?? await ndef.readNdef();
    }
    return null;
  }

  Future<void> _writeNdefMessage(NfcTag tag, NdefMessage message) async {
    if (Platform.isAndroid) {
      final ndef = NdefAndroid.from(tag);
      if (ndef == null || !ndef.isWritable) throw Exception('Tag de solo lectura o sin NDEF');
      await ndef.writeNdefMessage(message);
    } else if (Platform.isIOS) {
      final ndef = NdefIos.from(tag);
      if (ndef == null || ndef.status != NdefStatusIos.readWrite) throw Exception('Tag de solo lectura o sin NDEF');
      await ndef.writeNdef(message);
    } else {
      throw UnsupportedError('NFC solo está soportado en iOS y Android.');
    }
  }
}
