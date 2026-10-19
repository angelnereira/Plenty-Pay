/// F23.1 · Escáner QR con validación de host y regex.
///
/// Reglas de `flutter-standards.md` §10:
///
/// 1. El contenido es `https://<host>/t/<code>` con `code` de forma
///    `^[A-Za-z0-9_-]{8,64}$`.
/// 2. El host debe estar en la lista permitida del flavor; si no, **advertencia y no
///    abre** — nunca se "corrige" ni se navega a un host desconocido.
/// 3. El contenido del tag nunca se muestra como verdad: la app pide el enlace al
///    servidor y muestra el comercio verificado.
library;

/// Por qué un contenido escaneado no se puede usar.
enum QrRejection {
  /// No es un QR de PlentyPay.
  notAPaymentLink,

  /// El host no está en la lista permitida del flavor.
  hostNotAllowed,

  /// El código no cumple el formato o el largo.
  invalidCode,

  /// El enlace es de otro esquema o no trae código.
  malformed,
}

class QrPaymentLink {
  const QrPaymentLink({required this.code, required this.host});

  /// Código opaco `^[A-Za-z0-9_-]{8,64}$`. Se envía al servidor; nunca se registra
  /// en claro ni se incluye en un mensaje de error.
  final String code;
  final String host;
}

/// Resultado del escaneo: o bien el enlace, o bien el motivo del rechazo con un
/// mensaje ya traducido.
class QrScanResult {
  const QrScanResult.accepted(this.link)
      : rejection = null,
        message = null;

  const QrScanResult.rejected(this.rejection, this.message) : link = null;

  final QrPaymentLink? link;
  final QrRejection? rejection;

  /// Mensaje para el usuario, ya traducido desde el glosario. Nunca el contenido
  /// crudo del QR ni un código técnico.
  final String? message;

  bool get isAccepted => link != null;
}

/// Regex del código. El rango es el del estándar (§10.1): 8 a 64 caracteres.
final RegExp paymentCodePattern = RegExp(r'^[A-Za-z0-9_-]{8,64}$');

/// Hosts permitidos por flavor. Un QR de un host desconocido no abre nada.
const Set<String> allowedQrHosts = {'plentypay.app', 'www.plentypay.app'};

/// Analiza el contenido de un QR de cobro.
QrScanResult parsePaymentQr(String raw, {Set<String>? allowedHosts}) {
  final hosts = allowedHosts ?? allowedQrHosts;
  final content = raw.trim();
  if (content.isEmpty) {
    return const QrScanResult.rejected(
      QrRejection.malformed,
      'Ese código no es un enlace de pago de PlentyPay.',
    );
  }

  final uri = Uri.tryParse(content);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    return const QrScanResult.rejected(
      QrRejection.notAPaymentLink,
      'Ese código no es un enlace de pago de PlentyPay.',
    );
  }

  // Solo `https`. Un `http://` en un QR de mostrador es una señal de manipulación.
  if (uri.scheme.toLowerCase() != 'https') {
    return const QrScanResult.rejected(
      QrRejection.notAPaymentLink,
      'Ese código no es un enlace de pago de PlentyPay.',
    );
  }

  final host = uri.host.toLowerCase();
  if (!hosts.contains(host)) {
    return const QrScanResult.rejected(
      QrRejection.hostNotAllowed,
      'Este código no es de PlentyPay. No lo abras si no esperabas escanearlo.',
    );
  }

  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.length != 2 || segments.first != 't') {
    return const QrScanResult.rejected(
      QrRejection.malformed,
      'Ese enlace no corresponde a un cobro.',
    );
  }

  final code = segments[1];
  if (!paymentCodePattern.hasMatch(code)) {
    return const QrScanResult.rejected(
      QrRejection.invalidCode,
      'Ese código de cobro no es válido.',
    );
  }

  return QrScanResult.accepted(QrPaymentLink(code: code, host: host));
}

/// F23.2 · NFC NDEF.
///
/// Solo lectura y escritura de un registro **URI** con el mismo formato que el QR.
/// No se emula tarjeta (HCE) ni se lee tarjeta EMV (`security-standards.md` §9):
/// un NDEF con payload binario o con otro tipo de URI se rechaza.
class NdefRecord {
  const NdefRecord({required this.type, required this.payload});

  /// "uri" | "text" | "mime" | … (tipos NDEF TNF-1).
  final String type;

  /// Contenido del registro.
  final String payload;
}

/// NFC solo acepta un registro URI que pase el mismo análisis del QR.
QrScanResult parseNdefUri(String uri) => parsePaymentQr(uri);

/// Escribe un registro URI NDEF con el enlace de cobro.
NdefRecord buildNdefUri(String code) {
  if (!paymentCodePattern.hasMatch(code)) {
    throw ArgumentError.value(code, 'code', 'formato de código de cobro inválido');
  }
  return NdefRecord(type: 'uri', payload: 'https://plentypay.app/t/$code');
}

/// F23.4 · Estado de pago mostrado al usuario.
///
/// `UNKNOWN` **nunca** se muestra como fallo: la pantalla dice "estamos confirmando"
/// y sigue consultando hasta que el pago llegue a un estado terminal
/// (`flutter-standards.md` §10.5).
enum PaymentDisplay {
  pending,
  unknown,
  captured,
  failed,
  refunded,

  /// Un estado que la app no conoce: se trata como `unknown`, nunca como fallo.
  unsupported;

  /// `true` solo cuando el pago está definitivamente rechazado.
  bool get isDefinitiveFailure => this == PaymentDisplay.failed;

  /// `true` cuando todavía no se sabe: la UI mantiene el sondeo y no cierra la pantalla.
  bool get isStillConfirming => this == PaymentDisplay.pending || this == PaymentDisplay.unknown;
}

/// Convierte el estado del servidor a lo que se muestra.
///
/// Un estado desconocido se degrada a `unknown`: mostrarlo como fallo haría creer al
/// usuario que perdió dinero cuando el servidor quizá lo cobró.
PaymentDisplay paymentDisplayFor(String? serverStatus) {
  switch ((serverStatus ?? '').toUpperCase()) {
    case 'PENDING':
    case 'CREATED':
    case 'REQUIRES_ACTION':
      return PaymentDisplay.pending;
    case 'CAPTURED':
    case 'SETTLED':
    case 'SUCCEEDED':
      return PaymentDisplay.captured;
    case 'FAILED':
    case 'CANCELED':
    case 'CANCELLED':
      return PaymentDisplay.failed;
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return PaymentDisplay.refunded;
    case 'UNKNOWN':
      return PaymentDisplay.unknown;
    default:
      return PaymentDisplay.unknown;
  }
}

/// F23.3 · Biometría local y step-up.
///
/// El paso 1 exige biometría local siempre; el paso 2 (step-up en el servidor) se pide
/// cuando el importe supera el umbral vigente. El umbral **no es una constante**:
/// llega por configuración porque es un límite de riesgo del negocio, no del código
/// (`security-standards.md` §4, AGENTS.md §2.13).
class StepUpPolicy {
  const StepUpPolicy({required this.minorThreshold, required this.biometricAvailable});

  /// Umbral de step-up en centavos. `0` = cualquier pago exige step-up.
  final int minorThreshold;

  /// Si el dispositivo tiene biometría disponible y enrolada.
  final bool biometricAvailable;

  bool requiresBiometric(int amountMinor) => biometricAvailable;

  /// El step-up se pide cuando el importe **iguala o supera** el umbral.
  bool requiresStepUp(int amountMinor) => amountMinor >= minorThreshold;
}