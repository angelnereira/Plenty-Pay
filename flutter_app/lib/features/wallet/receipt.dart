import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/money_text.dart';
import '../../core/format/dates.dart';

/// F23.7 · Recibo compartible.
///
/// El recibo se genera en el dispositivo a partir de los datos que el servidor ya
/// confirmó. Solo contiene lo que el usuario puede ver en su historial: **nunca** el
/// número de tarjeta, ni el CVV, ni un token del proveedor (AGENTS.md §2.17).
///
/// El documento se arma con `Text` en una superficie de tamaño fijo de recibo, lo que
/// permite un golden estable y un `RepaintBoundary` para capturar la imagen.
class ReceiptLine {
  const ReceiptLine({required this.label, required this.minor});

  final String label;
  final int minor;
}

/// Lo que el recibo necesita. Todos los importes en enteros minor (ADR 0013).
@immutable
class ReceiptData {
  const ReceiptData({
    required this.merchantName,
    required this.merchantTaxId,
    required this.operationCode,
    required this.paidAt,
    required this.lines,
    required this.totalMinor,
    required this.currencySymbol,
    this.customerName,
    this.customerMaskedId,
    this.paymentMethodLabel,
  });

  final String merchantName;

  /// RUC del comercio: es un identificador fiscal público de la entidad, no un dato
  /// personal del pagador.
  final String merchantTaxId;

  /// Código de operación, corto y no secuencial en el tiempo.
  final String operationCode;
  final DateTime paidAt;
  final List<ReceiptLine> lines;
  final int totalMinor;
  final String currencySymbol;
  final String? customerName;

  /// Cédula del pagador **siempre enmascarada** (N-DAT-04, N-FMT-05).
  final String? customerMaskedId;
  final String? paymentMethodLabel;
}

/// Ancho fijo del recibo: 320 dp ≈ 80 mm. El recibo se lee en una impresora
/// térmica o en un móvil, no en una hoja A4.
const double receiptWidth = 320;

class ReceiptView extends StatelessWidget {
  const ReceiptView({super.key, required this.data});

  final ReceiptData data;

  /// Formatea una fecha con el mes **en texto** (N-STD-10): ninguna fecha se muestra
  /// solo con números.
  static String formatDate(DateTime d, String locale) {
    return longDateTime(d.toLocal(), locale);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toString();
    final bold = theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600);

    return RepaintBoundary(
      child: Container(
        width: receiptWidth,
        padding: const EdgeInsets.all(16),
        color: theme.colorScheme.surface,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(data.merchantName, style: bold),
            Text(data.merchantTaxId, style: theme.textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(formatDate(data.paidAt, locale), style: theme.textTheme.bodySmall),
            const Divider(height: 24),
            for (final line in data.lines)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text(line.label, style: theme.textTheme.bodyMedium)),
                    MoneyText(line.minor, symbol: data.currencySymbol, style: theme.textTheme.bodyMedium),
                  ],
                ),
              ),
            const Divider(height: 24),
            Row(
              children: [
                Expanded(child: Text(l10n.receiptTotal, style: bold)),
                MoneyText(data.totalMinor, symbol: data.currencySymbol, style: bold),
              ],
            ),
            if (data.customerName != null) ...[
              const SizedBox(height: 12),
              Text(data.customerName!, style: theme.textTheme.bodySmall),
            ],
            if (data.customerMaskedId != null)
              Text(data.customerMaskedId!, style: theme.textTheme.bodySmall),
            if (data.paymentMethodLabel != null) ...[
              const SizedBox(height: 4),
              Text('${l10n.receiptPaidWith}: ${data.paymentMethodLabel}',
                  style: theme.textTheme.bodySmall),
            ],
            const SizedBox(height: 12),
            Text(
              l10n.receiptOperationCode(data.operationCode),
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

/// F24.1 · Receipt layout a 80 mm.
///
/// El ancho viene de una constante del componente, no de un literal suelto: el
/// documento de impresión y la vista deben medir exactamente lo mismo.
class ReceiptPrintLayout {
  const ReceiptPrintLayout({this.width = receiptWidth});

  /// 80 mm a 96 dpi ≈ 302 dp; se redondea al múltiplo que usa el ticket.
  final double width;

  /// El contenido nunca excede el ancho: si el texto es largo, se ajusta.
  bool fitsInWidth(double contentWidth) => contentWidth <= width;

  /// Formato de la impresora ESC/POS.
  String escPosFormat() => '80mm';

  /// advance con el corte de papel, en puntos a 203 dpi.
  String escPosCutCommand() => '\n\n\n\x1dV\x00';
}

/// Serializa el recibo a texto plano para compartirlo sin adjuntar un PDF.
///
/// El formato es deliberadamente simple y estable: un `key=value` por línea, fechas
/// ISO 8601 en UTC y todos los importes en enteros minor. Nada de aquí lleva datos
/// de tarjeta.
String encodeReceiptPlainText(ReceiptData data) {
  final buf = StringBuffer()
    ..writeln('merchant=${data.merchantName}')
    ..writeln('tax_id=${data.merchantTaxId}')
    ..writeln('operation=${data.operationCode}')
    // ISO 8601 en UTC: el formato de almacenamiento es siempre UTC (N-STD-09).
    ..writeln('paid_at=${data.paidAt.toUtc().toIso8601String()}')
    ..writeln('currency=${data.currencySymbol}');
  for (final line in data.lines) {
    buf.writeln('item=${jsonEncode(line.label)}:${line.minor}');
  }
  buf.write('total=${data.totalMinor}');
  return buf.toString();
}