import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/security/biometric_service.dart';
import '../data/nfc_tag_service.dart';
import '../data/payment_repository.dart';

/// Pagos por QR y por tag NFC.
///
/// Lo que funciona hoy (con el backend de este repo):
///   • Cliente: escanear un QR o tocar un tag NFC de un comercio → ver el nombre
///     verificado por el servidor → ingresar monto → confirmar con biometría → pagar.
///   • Comercio: crear una terminal, mostrar su QR y programar un tag NFC.
///
/// Lo que NO hace (y la pantalla lo dice): cobrar el "tap" de una tarjeta
/// Visa/Mastercard/Apple Pay/Google Pay. Eso es Tap to Pay/SoftPOS y exige el
/// SDK de un PSP certificado — ver MIGRATION_STATUS.md.
class NfcPayScreen extends StatelessWidget {
  const NfcPayScreen({
    super.key,
    required this.paymentRepository,
    required this.nfcTagService,
    required this.biometricService,
  });

  final PaymentRepository paymentRepository;
  final NfcTagService nfcTagService;
  final BiometricService biometricService;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Pagos'),
          bottom: const TabBar(tabs: [Tab(text: 'Pagar'), Tab(text: 'Cobrar')]),
        ),
        body: TabBarView(
          children: [
            _PayTab(paymentRepository: paymentRepository, nfcTagService: nfcTagService, biometricService: biometricService),
            _CollectTab(paymentRepository: paymentRepository, nfcTagService: nfcTagService),
          ],
        ),
      ),
    );
  }
}

// ── Pestaña "Pagar" (cliente) ────────────────────────────────────────────────

class _PayTab extends StatefulWidget {
  const _PayTab({required this.paymentRepository, required this.nfcTagService, required this.biometricService});
  final PaymentRepository paymentRepository;
  final NfcTagService nfcTagService;
  final BiometricService biometricService;

  @override
  State<_PayTab> createState() => _PayTabState();
}

class _PayTabState extends State<_PayTab> {
  bool _nfcListening = false;
  bool _resolving = false;
  String? _error;

  @override
  void dispose() {
    widget.nfcTagService.stop();
    super.dispose();
  }

  Future<void> _scanQr() async {
    setState(() => _error = null);
    final raw = await Navigator.of(context).push<String>(MaterialPageRoute(builder: (_) => const _QrScanPage()));
    if (raw == null || !mounted) return;
    final payload = widget.nfcTagService.parsePaymentLink(raw);
    if (payload == null) {
      setState(() => _error = 'Ese QR no es un código de pago válido de PlentyPay.');
      return;
    }
    await _openTerminal(payload.terminalCode);
  }

  Future<void> _readNfc() async {
    setState(() {
      _error = null;
      _nfcListening = true;
    });
    await widget.nfcTagService.startReading(
      onPaymentTag: (payload) {
        if (!mounted) return;
        setState(() => _nfcListening = false);
        _openTerminal(payload.terminalCode);
      },
      onError: (message) {
        if (!mounted) return;
        setState(() {
          _nfcListening = false;
          _error = message;
        });
      },
    );
  }

  Future<void> _cancelNfc() async {
    await widget.nfcTagService.stop();
    if (mounted) setState(() => _nfcListening = false);
  }

  Future<void> _openTerminal(String code) async {
    setState(() => _resolving = true);
    try {
      final terminal = await widget.paymentRepository.resolveTerminal(code);
      if (!mounted) return;
      if (!terminal.isActive) {
        setState(() => _error = 'Esta terminal está desactivada.');
        return;
      }
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => _PaySheet(
          terminal: terminal,
          paymentRepository: widget.paymentRepository,
          biometricService: widget.biometricService,
        ),
      );
    } on Exception catch (e) {
      if (mounted) setState(() => _error = 'No se pudo abrir la terminal: $e');
    } finally {
      if (mounted) setState(() => _resolving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        FilledButton.icon(
          onPressed: _resolving ? null : _scanQr,
          icon: const Icon(Icons.qr_code_scanner_rounded),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Escanear QR')),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: (_resolving || _nfcListening) ? null : _readNfc,
          icon: const Icon(Icons.nfc_rounded),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Tocar tag NFC del comercio')),
        ),
        if (_nfcListening) ...[
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2)),
              title: const Text('Acerca el teléfono al tag…'),
              trailing: TextButton(onPressed: _cancelNfc, child: const Text('Cancelar')),
            ),
          ),
        ],
        if (_resolving) const Padding(padding: EdgeInsets.only(top: 16), child: LinearProgressIndicator()),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 24),
        const _EmvNoticeCard(),
      ],
    );
  }
}

class _PaySheet extends StatefulWidget {
  const _PaySheet({required this.terminal, required this.paymentRepository, required this.biometricService});
  final TerminalInfo terminal;
  final PaymentRepository paymentRepository;
  final BiometricService biometricService;

  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  final _amountController = TextEditingController();
  static const _rails = <String, String>{
    'YAPPY': 'Yappy',
    'TELERED_CLAVE': 'Tarjeta Clave (TELERED)',
    'CARD_VISA': 'Tarjeta Visa',
    'CARD_MASTERCARD': 'Tarjeta Mastercard',
  };
  String _rail = 'YAPPY';
  late String _idempotencyKey = widget.paymentRepository.newIdempotencyKey();
  bool _busy = false;
  String? _error;
  PaymentResult? _result;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  /// "12.50" o "12,50" → 1250. Sin doble/float: aritmética entera.
  int? _parseCents(String raw) {
    final m = RegExp(r'^(\d{1,7})(?:[.,](\d{1,2}))?$').firstMatch(raw.trim());
    if (m == null) return null;
    final whole = int.parse(m.group(1)!);
    final fraction = (m.group(2) ?? '').padRight(2, '0');
    return whole * 100 + int.parse(fraction);
  }

  // Cambiar monto o riel = otra operación → clave de idempotencia nueva.
  void _newOperation() => _idempotencyKey = widget.paymentRepository.newIdempotencyKey();

  Future<void> _confirm() async {
    final cents = _parseCents(_amountController.text);
    if (cents == null || cents <= 0) {
      setState(() => _error = 'Ingresa un monto válido, por ejemplo 12.50');
      return;
    }
    final confirmed = await widget.biometricService.confirmPayment(
      reason: 'Confirma el pago de \$${(cents / 100).toStringAsFixed(2)} a ${widget.terminal.merchantName}',
    );
    if (!confirmed) {
      setState(() => _error = 'Confirmación cancelada.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await widget.paymentRepository.pay(
        terminalCode: widget.terminal.publicCode,
        amountCents: cents,
        rail: _rail,
        idempotencyKey: _idempotencyKey, // un reintento por mala red reutiliza la misma clave
      );
      if (mounted) setState(() => _result = result);
    } on Exception catch (e) {
      if (mounted) setState(() => _error = 'No se pudo procesar el pago: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 0, 24, 24 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Pagar a ${widget.terminal.merchantName}', style: Theme.of(context).textTheme.titleLarge),
            if (widget.terminal.label.isNotEmpty) Text(widget.terminal.label),
            const SizedBox(height: 16),
            if (_result == null) ...[
              TextField(
                controller: _amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => _newOperation(),
                decoration: const InputDecoration(labelText: 'Monto (USD)', prefixText: r'$ ', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              // ignore: deprecated_member_use
              DropdownButtonFormField<String>(
                value: _rail, // en Flutter ≥3.33 `value` está deprecado a favor de `initialValue`; se usa `value` por compatibilidad con 3.27+
                decoration: const InputDecoration(labelText: 'Pagar con', border: OutlineInputBorder()),
                items: [for (final e in _rails.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _rail = value);
                  _newOperation();
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _confirm,
                child: _busy
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Confirmar con biometría'),
              ),
            ] else
              _ResultView(result: _result!),
          ],
        ),
      ),
    );
  }
}

class _ResultView extends StatelessWidget {
  const _ResultView({required this.result});
  final PaymentResult result;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (result.sandbox)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(12)),
            child: const Text(
              'MODO SIMULADO: el riel no tiene credenciales reales configuradas. '
              'No se movió dinero real.',
              style: TextStyle(color: Colors.black87),
            ),
          ),
        Text('Estado: ${result.status}', style: Theme.of(context).textTheme.titleMedium),
        Text('Referencia: ${result.transactionId}'),
        if (result.failureReason != null) Text('Detalle: ${result.failureReason}'),
        if (result.nextActionQrPayload != null) ...[
          const SizedBox(height: 16),
          const Text('Aprueba el pago en tu app del banco escaneando este código:'),
          const SizedBox(height: 8),
          Center(child: QrImageView(data: result.nextActionQrPayload!, size: 200)),
        ],
        const SizedBox(height: 16),
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Listo')),
      ],
    );
  }
}

// ── Pestaña "Cobrar" (comercio) ──────────────────────────────────────────────

class _CollectTab extends StatefulWidget {
  const _CollectTab({required this.paymentRepository, required this.nfcTagService});
  final PaymentRepository paymentRepository;
  final NfcTagService nfcTagService;

  @override
  State<_CollectTab> createState() => _CollectTabState();
}

class _CollectTabState extends State<_CollectTab> {
  final _labelController = TextEditingController(text: 'Caja principal');
  TerminalInfo? _terminal;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _labelController.dispose();
    widget.nfcTagService.stop();
    super.dispose();
  }

  Future<void> _createTerminal() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final terminal = await widget.paymentRepository.createTerminal(_labelController.text.trim());
      if (mounted) setState(() => _terminal = terminal);
    } on Exception catch (e) {
      if (mounted) setState(() => _error = 'No se pudo crear la terminal: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _writeTag() async {
    final terminal = _terminal;
    if (terminal == null) return;
    final messenger = ScaffoldMessenger.of(context);
    await widget.nfcTagService.writeTerminalTag(
      terminalCode: terminal.publicCode,
      onWritten: () => messenger.showSnackBar(const SnackBar(content: Text('Tag programado.'))),
      onError: (message) => messenger.showSnackBar(SnackBar(content: Text(message))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final terminal = _terminal;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (terminal == null) ...[
          TextField(
            controller: _labelController,
            decoration: const InputDecoration(labelText: 'Nombre de la terminal', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy ? null : _createTerminal,
            child: _busy
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Crear terminal de cobro'),
          ),
        ] else ...[
          Center(child: QrImageView(data: widget.nfcTagService.buildPaymentLink(terminal.publicCode), size: 240)),
          const SizedBox(height: 8),
          Center(child: SelectableText(widget.nfcTagService.buildPaymentLink(terminal.publicCode))),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _writeTag,
            icon: const Icon(Icons.nfc_rounded),
            label: const Text('Programar tag NFC con esta terminal'),
          ),
          const SizedBox(height: 8),
          const Text(
            'El QR y el tag llevan solo un código de terminal. El cliente ingresa el monto y '
            'confirma con biometría; el servidor valida a qué comercio pertenece.',
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
        const SizedBox(height: 24),
        const _EmvNoticeCard(),
      ],
    );
  }
}

// ── Aviso honesto sobre Tap to Pay ───────────────────────────────────────────

class _EmvNoticeCard extends StatelessWidget {
  const _EmvNoticeCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.info_outline_rounded),
              const SizedBox(width: 8),
              Text('Cobro con tarjeta por contactless', style: Theme.of(context).textTheme.titleSmall),
            ]),
            const SizedBox(height: 8),
            const Text(
              'Aceptar el "tap" de una tarjeta Visa/Mastercard o de Apple Pay/Google Pay '
              'todavía no está disponible: requiere activar un procesador de pagos certificado '
              '(Tap to Pay). Mientras tanto, usa QR o tags NFC de PlentyPay.',
            ),
          ],
        ),
      ),
    );
  }
}

// ── Escáner QR ───────────────────────────────────────────────────────────────

class _QrScanPage extends StatefulWidget {
  const _QrScanPage();

  @override
  State<_QrScanPage> createState() => _QrScanPageState();
}

class _QrScanPageState extends State<_QrScanPage> {
  final MobileScannerController _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escanear QR')),
      body: MobileScanner(
        controller: _controller,
        onDetect: (capture) {
          if (_handled) return;
          final raw = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
          if (raw == null) return;
          _handled = true;
          Navigator.of(context).pop(raw);
        },
      ),
    );
  }
}
