import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../format/barcode.dart';

/// Lector de códigos que actúa como teclado (HID, F16.11): mientras ningún campo de texto tiene el
/// foco, junta las teclas que llegan muy seguidas y, con Enter, entrega el código a [onScan]. Con
/// un campo enfocado no intercepta nada: lo tecleado va al campo.
class HidScannerListener extends StatefulWidget {
  const HidScannerListener(
      {super.key,
      required this.onScan,
      required this.child,
      this.enabled = true,
      this.now});

  final ValueChanged<String> onScan;
  final Widget child;
  final bool enabled;

  /// Reloj (pruebas).
  final DateTime Function()? now;

  @override
  State<HidScannerListener> createState() => _HidScannerListenerState();
}

class _HidScannerListenerState extends State<HidScannerListener> {
  final _buffer = ScanBuffer();

  @override
  void initState() {
    super.initState();
    HardwareKeyboard.instance.addHandler(_onKey);
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_onKey);
    super.dispose();
  }

  bool get _textFieldFocused {
    final ctx = FocusManager.instance.primaryFocus?.context;
    if (ctx == null) return false;
    return ctx.widget is EditableText ||
        ctx.findAncestorWidgetOfExactType<EditableText>() != null;
  }

  bool _onKey(KeyEvent event) {
    if (!widget.enabled || !mounted || event is KeyUpEvent) return false;
    if (_textFieldFocused) return false;
    // Solo la ruta visible escucha: una pantalla tapada por otra no recibe lecturas.
    if (!(ModalRoute.of(context)?.isCurrent ?? true)) return false;
    final at = (widget.now ?? DateTime.now)();
    final key = event.logicalKey;
    if (key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.numpadEnter) {
      final code = _buffer.enter(at);
      if (code != null) widget.onScan(code);
      return code != null;
    }
    final ch = event.character;
    if (ch != null && ch.length == 1 && ch.codeUnitAt(0) >= 0x20) {
      _buffer.add(ch, at);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
