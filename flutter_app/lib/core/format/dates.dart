import 'package:intl/intl.dart';

// Fechas con el mes en texto (N-STD-10), según el idioma: «22 de octubre de 2026» en español,
// «October 22, 2026» en inglés. Un patrón literal como 'd MMMM y' pierde las preposiciones del
// español («22 octubre 2026»); por eso se usan los formatos de la configuración regional.

/// «22 de octubre de 2026».
String longDate(DateTime t, String locale) => DateFormat.yMMMMd(locale).format(t);

/// «22 de octubre de 2026 · 19:33».
String longDateTime(DateTime t, String locale) =>
    '${DateFormat.yMMMMd(locale).format(t)} · ${DateFormat.Hm(locale).format(t)}';
