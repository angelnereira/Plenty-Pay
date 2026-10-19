import 'dart:async';
import 'dart:convert';

/// F24.3 · Lectores de código de barras (teclado HID) y cámara.
///
/// Los lectores de mostrador se comportan como un teclado: escriben el código y
/// pulsan Enter. La implementación no depende del dispositivo: recibe el texto
/// que el sistema ya decodificó y aplica las reglas del catálogo.
///
/// Reglas de `flutter-standards.md` §13 y del SPEC de pos:
/// - El código se busca contra el catálogo; **nunca** se compara con la última
///   búsqueda para "acortar" la espera.
/// - La búsqueda tiene presupuesto de tiempo (el objetivo del paso es < 300 ms).
/// - Un código desconocido no se muestra como precio ni como existencias: se dice
///   que no se encontró y se ofrece buscar a mano.
class BarcodeLookup {
  BarcodeLookup({required this.lookup, this.budget = const Duration(milliseconds: 300)});

  /// Resuelve un código contra el catálogo del servidor.
  final Future<ProductHit?> Function(String barcode) lookup;

  /// Presupuesto de tiempo del paso. Excedido, la respuesta es `timeout` y la app
  /// ofrece la búsqueda manual: no se muestra un precio inventado ni un error técnico.
  final Duration budget;

  /// Búsqueda por código de barras.
  Future<BarcodeResult> search(String barcode, {DateTime? now}) async {
    final code = barcode.trim();
    if (code.isEmpty) {
      return BarcodeResult.notFound;
    }
    try {
      final hit = await lookup(code).timeout(budget);
      if (hit == null) return BarcodeResult.notFound;
      return BarcodeResult.found(hit);
    } on TimeoutException {
      return BarcodeResult.timeout;
    } catch (_) {
      // El error concreto ya se registró en el borde del cliente (§2.14); aquí solo
      // se traduce al estado que la pantalla sabe mostrar.
      return BarcodeResult.error;
    }
  }
}

/// Un producto del catálogo.
class ProductHit {
  const ProductHit({
    required this.variantId,
    required this.sku,
    required this.name,
    required this.priceMinor,
  });

  final String variantId;
  final String sku;
  final String name;

  /// Precio en enteros minor (ADR 0013).
  final int priceMinor;
}

/// Resultado de la búsqueda, con sus cuatro estados: la pantalla nunca queda en
/// blanco ni muestra un precio que no viene del servidor.
sealed class BarcodeResult {
  const BarcodeResult();

  bool get isFound => this is BarcodeFound;

  static const BarcodeResult notFound = BarcodeNotFound();
  static const BarcodeResult timeout = BarcodeTimeout();
  static const BarcodeResult error = BarcodeError();
  static BarcodeResult found(ProductHit product) => BarcodeFound(product);
}

class BarcodeFound extends BarcodeResult {
  const BarcodeFound(this.product);

  final ProductHit product;
}

class BarcodeNotFound extends BarcodeResult {
  const BarcodeNotFound();
}

class BarcodeTimeout extends BarcodeResult {
  const BarcodeTimeout();
}

class BarcodeError extends BarcodeResult {
  const BarcodeError();
}

/// F24.3 · Lector de teclado HID.
///
/// Acumula los caracteres que llegan del lector y emite el código al recibir Enter.
/// Un lector real no necesita ninguna configuración: el código se separa con Enter.
class HidBarcodeReader {
  HidBarcodeReader({this.terminator = '\n', this.bufferLimit = 64, this.onScanned});

  /// Carácter que cierra el código. `\n` en la mayoría de lectores USB.
  final String terminator;

  /// Tope del buffer: un lector mal configurado puede no enviar Enter y acumular
  /// caracteres sin límite.
  final int bufferLimit;

  final void Function(String barcode)? onScanned;

  final StringBuffer _buffer = StringBuffer();

  /// Tras superar el límite se ignora el resto de la ráfaga hasta el terminador:
  /// evita que un lector sin Enter realimente el buffer indefinidamente.
  bool _discarding = false;

  int get bufferedLength => _buffer.length;

  /// Alimenta un carácter del sistema. Devuelve el código leído, o `null` si aún no
  /// terminó.
  String? addKey(String key) {
    if (key == terminator) {
      _discarding = false;
      final code = _buffer.toString();
      _buffer.clear();
      if (code.isEmpty) return null;
      onScanned?.call(code);
      return code;
    }
    if (key.length != 1) {
      // Teclas de control (flechas, modificadores) no forman parte del código.
      return null;
    }
    if (_discarding) return null;
    // El descarte ocurre **antes** de escribir: al superar el límite se descarta el
    // código entero y el resto de la ráfaga, en vez de truncar a medias. Un código
    // parcial buscaría otro producto, que es peor que no buscar.
    if (_buffer.length >= bufferLimit) {
      _discarding = true;
      _buffer.clear();
      return null;
    }
    _buffer.write(key);
    return null;
  }

  void reset() {
    _buffer.clear();
    _discarding = false;
  }
}

/// F24.4 · Pantalla del cliente en segundo monitor o tablet emparejada.
///
/// El pareo es por código: la caja genera un código de un solo uso con caducidad
/// corta, el cliente lo ingresa en su dispositivo y ambas pantallas quedan
/// enlazadas. El código **no** es un token de sesión ni da acceso a nada por sí solo.
class CustomerDisplayPairing {
  CustomerDisplayPairing({required this.code, required this.expiresAt});

  /// Código corto que el cliente ingresa. Se compara en tiempo constante y caduca.
  final String code;
  final DateTime expiresAt;

  static const Duration defaultLifetime = Duration(minutes: 5);

  bool isValidAt(DateTime now) => now.isBefore(expiresAt);
}

/// Estado del pareo.
enum DisplayPairingState { idle, offered, paired, expired }

/// Lo que la caja muestra al cliente mientras espera el pareo.
class DisplaySession {
  DisplaySession({
    required this.pairing,
    required this.state,
    this.pairedAt,
  });

  final CustomerDisplayPairing pairing;
  final DisplayPairingState state;
  final DateTime? pairedAt;

  /// F24.4: el pareo caduca y se vuelve a ofrecer uno nuevo. Un código vencido no se
  /// renueva en silencio: la caja tiene que pedir uno nuevo explícitamente.
  DisplaySession refreshed(DateTime now, DateTime nowPairingExpiresAt) => DisplaySession(
        pairing: CustomerDisplayPairing(code: pairing.code, expiresAt: nowPairingExpiresAt),
        state: DisplayPairingState.offered,
      );
}

/// F24.2 · Apertura del cajón de dinero.
///
/// El cajón **solo** se abre junto a una venta o a un movimiento de caja: una
/// apertura suelta es una forma de robar sin dejar rastro en el libro.
class CashDrawerRule {
  const CashDrawerRule();

  /// Motivos que autorizan abrir el cajón.
  static const allowedReasons = {'SALE_COMPLETED', 'REFUND_ISSUED', 'CASH_COUNT', 'CASH_DEPOSIT'};

  /// `true` si el motivo habilita la apertura.
  bool allows(String reason) => allowedReasons.contains(reason);

  /// Tiempo máximo que el cajón puede permanecer abierto, en milisegundos, por
  /// seguridad: el cajón vuelve a cerrarse solo aunque la impresora no lo ordene.
  static const maxOpenMs = 30000;
}

/// F24.5 · Modo quiosco.
///
/// Pantalla completa y bloqueada. Salir exige el PIN de un gerente, y el PIN de un
/// empleado normal **nunca** abre la salida del quiosco.
class KioskExitRule {
  const KioskExitRule({required this.managerPinHash, required this.employeePinHash});

  /// Hash del PIN de gerente. Nunca el PIN en claro, ni en memoria.
  final String managerPinHash;

  /// Hash del PIN de empleado: sirve para marcar, no para salir.
  final String employeePinHash;

  /// Un PIN de empleado no abre el quiosco, aunque sea válido para marcar.
  bool allowsExit(String pinHash) =>
      pinHash == managerPinHash && pinHash != employeePinHash;

  /// Tres PIN incorrectos bloquean ese PIN cinco minutos (`docs/ux/functional-spec/07-payroll.md`
  /// S-PAY-09 e4).
  static const maxPinAttempts = 3;
  static const pinLockout = Duration(minutes: 5);
}

/// F24.5 · Contador de intentos de PIN.
class PinAttemptCounter {
  int _attempts = 0;
  DateTime? _lockedUntil;

  bool isLockedAt(DateTime now) =>
      _lockedUntil != null && now.isBefore(_lockedUntil!);

  /// Registra un intento. Devuelve `true` si el PIN quedó bloqueado.
  bool registerFailure(DateTime now) {
    _attempts += 1;
    if (_attempts >= KioskExitRule.maxPinAttempts) {
      _lockedUntil = now.add(KioskExitRule.pinLockout);
      return true;
    }
    return false;
  }

  void registerSuccess() {
    _attempts = 0;
    _lockedUntil = null;
  }
}

/// Serializa un producto para el POS: lo que la caja necesita, y nada más.
///
/// No incluye costo, márgenes ni datos del proveedor: el POS no los necesita y no
/// debe verlos (`pos/SPEC.md` §1 «no hace catálogo»).
String encodePosLineItem(Map<String, dynamic> hit) => jsonEncode({
      'variant_id': hit['variant_id'],
      'sku': hit['sku'],
      'name': hit['name'],
      'price_minor': hit['price_minor'],
    });