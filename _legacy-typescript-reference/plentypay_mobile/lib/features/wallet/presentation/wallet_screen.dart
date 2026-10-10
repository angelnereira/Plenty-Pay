import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../data/wallet_repository.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, required this.walletRepository});
  final WalletRepository walletRepository;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  late Future<WalletBalance> _balanceFuture;

  @override
  void initState() {
    super.initState();
    _balanceFuture = widget.walletRepository.getBalance();
  }

  Future<void> _refresh() async {
    setState(() => _balanceFuture = widget.walletRepository.getBalance());
    await _balanceFuture;
  }

  String _formatCents(int cents, String currency) {
    final formatter = NumberFormat.currency(symbol: currency == 'USD' ? r'$' : '$currency ', decimalDigits: 2);
    return formatter.format(cents / 100);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mi wallet')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<WalletBalance>(
          future: _balanceFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [Text('No se pudo cargar el saldo: ${snapshot.error}')],
              );
            }

            final balance = snapshot.data ?? WalletBalance.empty;

            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Disponible', style: Theme.of(context).textTheme.labelLarge),
                        const SizedBox(height: 4),
                        Text(
                          _formatCents(balance.availableCents, balance.currency),
                          style: Theme.of(context).textTheme.displaySmall,
                        ),
                        if (balance.heldCents > 0) ...[
                          const SizedBox(height: 12),
                          Text('Retenido (en proceso): ${_formatCents(balance.heldCents, balance.currency)}'),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {}, // TODO: navegar a features/nfc_pay (cobrar/pagar por QR)
                        icon: const Icon(Icons.qr_code_rounded),
                        label: const Text('Pagar / cobrar'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {}, // TODO: agregar a Apple Wallet / Google Wallet — ver documento 03
                        icon: const Icon(Icons.wallet_rounded),
                        label: const Text('Agregar a Wallet'),
                      ),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
