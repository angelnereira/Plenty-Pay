/// Códigos de barras (N-STD-23): un GTIN de 8, 12, 13 o 14 cifras con dígito de control correcto
/// se compara normalizado a 14 cifras con ceros a la izquierda. Se muestra como se capturó.
library;

const _gtinLengths = {8, 12, 13, 14};

/// Dígito de control GS1 correcto (pesos 3 y 1 desde la derecha, sin contar el control).
bool validGtin(String code) {
  if (!_gtinLengths.contains(code.length) || !RegExp(r'^\d+$').hasMatch(code)) {
    return false;
  }
  var sum = 0;
  for (var i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) {
    sum += (code.codeUnitAt(i) - 48) * w;
  }
  return (10 - sum % 10) % 10 == code.codeUnitAt(code.length - 1) - 48;
}

/// Clave de comparación: GTIN-14 si el código es un GTIN válido; si no, el código sin espacios.
String barcodeKey(String code) {
  final c = code.trim();
  return validGtin(c) ? c.padLeft(14, '0') : c;
}

/// Mismo producto: igual clave de código de barras.
bool sameBarcode(String a, String b) =>
    a.trim().isNotEmpty && barcodeKey(a) == barcodeKey(b);

/// Antirrebote de lecturas (F16.11): el mismo código en menos de [window] cuenta una vez.
class ScanDebouncer {
  ScanDebouncer(
      {this.window = const Duration(milliseconds: 800),
      DateTime Function()? now})
      : _now = now ?? DateTime.now;

  final Duration window;
  final DateTime Function() _now;
  String? _last;
  DateTime? _at;

  /// true si la lectura cuenta; false si repite la anterior dentro de la ventana.
  bool accept(String code) {
    final key = barcodeKey(code);
    final t = _now();
    final repeated = key == _last && _at != null && t.difference(_at!) < window;
    _last = key;
    _at = t;
    return !repeated;
  }
}

/// Acumula lo que teclea un lector HID (F16.11): caracteres seguidos muy rápido y Enter al final.
/// Una pausa mayor que [gap] entre teclas descarta lo acumulado (era una persona tecleando).
class ScanBuffer {
  ScanBuffer(
      {this.gap = const Duration(milliseconds: 100), this.minLength = 4});

  final Duration gap;
  final int minLength;
  final _chars = StringBuffer();
  DateTime? _lastKey;

  /// Agrega un carácter leído en [at].
  void add(String char, DateTime at) {
    if (_lastKey != null && at.difference(_lastKey!) > gap) _chars.clear();
    _chars.write(char);
    _lastKey = at;
  }

  /// Enter en [at]: devuelve el código si llegó como lectura de un lector; si no, null.
  String? enter(DateTime at) {
    final fast = _lastKey != null && at.difference(_lastKey!) <= gap;
    final code = _chars.toString().trim();
    _chars.clear();
    _lastKey = null;
    return fast && code.length >= minLength ? code : null;
  }
}
