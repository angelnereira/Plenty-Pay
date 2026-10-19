import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/widgets/money_text.dart';

/// S-POS-06 · `/pos/parked` · Ventas estacionadas.
class PosParkedScreen extends StatefulWidget {
  const PosParkedScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<PosParkedScreen> createState() => _PosParkedScreenState();
}

class _PosParkedScreenState extends State<PosParkedScreen> {
  final List<Map<String, dynamic>> _parked = [
    {
      'id': 'P-101',
      'note': 'Mesa 4 · Terraza',
      'time': 'Hace 12 min',
      'items': 3,
      'totalMinor': 1450,
    },
    {
      'id': 'P-102',
      'note': 'Cliente en mostrador (Juan Pérez)',
      'time': 'Hace 5 min',
      'items': 2,
      'totalMinor': 820,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ventas estacionadas')),
      body: SafeArea(
        child: _parked.isEmpty
            ? const Center(child: Text('No hay ventas estacionadas.'))
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _parked.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, i) {
                  final sale = _parked[i];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(sale['note'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                                const SizedBox(height: 4),
                                Text('${sale['items']} productos · ${sale['time']}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                              ],
                            ),
                          ),
                          MoneyText(sale['totalMinor'] as int, style: const TextStyle(fontWeight: FontWeight.bold)),
                          const SizedBox(width: 12),
                          FilledButton.tonal(
                            onPressed: () {
                              Navigator.of(context).pop(sale);
                            },
                            child: const Text('Recuperar'),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
