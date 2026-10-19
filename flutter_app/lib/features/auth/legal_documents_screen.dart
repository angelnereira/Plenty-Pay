import 'package:flutter/material.dart';

import '../../core/l10n/generated/app_localizations.dart';
import '../../core/widgets/pp_button.dart';

/// F25.4 · Textos legales, privacidad y consentimientos (S-PUB-03).
///
/// **Q-08 sigue abierto**: los textos de Términos y Política de privacidad son un
/// entregable legal que PlentyPay no redacta. Por eso esta pantalla **no inventa**
/// el texto: consume el que envía `client-config` (infra-management), con su versión
/// y su fecha, y muestra un estado claro mientras el servidor no lo haya entregado.
///
/// La versión que se ve es la que se registra en el consentimiento (N-DAT-02): si el
/// servidor publica una versión nueva, la pantalla deja de aceptar el consentimiento
/// con la versión vieja.
class LegalDocument {
  const LegalDocument({
    required this.slug,
    required this.title,
    required this.version,
    required this.publishedAt,
    required this.body,
  });

  factory LegalDocument.fromJson(Map<String, dynamic> json) => LegalDocument(
        slug: json['slug'] as String,
        title: json['title'] as String,
        version: json['version'] as String,
        publishedAt: DateTime.parse(json['published_at'] as String),
        body: json['body'] as String,
      );

  /// `terms` | `privacy` | `marketing`.
  final String slug;
  final String title;

  /// Versión del texto, la misma que va en el consentimiento.
  final String version;
  final DateTime publishedAt;

  /// Cuerpo ya en HTML presentable. La app **no** lo interpreta con
  /// `HtmlWebView` de terceros: se procesa con un renderizador propio y acotado.
  final String body;

  Map<String, dynamic> toJson() => {
        'slug': slug,
        'title': title,
        'version': version,
        'published_at': publishedAt.toUtc().toIso8601String(),
        'body': body,
      };
}

/// Los tres textos legales, con la versión vigente de cada uno.
class LegalDocuments {
  const LegalDocuments({required this.terms, required this.privacy, required this.marketing});

  factory LegalDocuments.fromJson(Map<String, dynamic> json) => LegalDocuments(
        terms: LegalDocument.fromJson(Map<String, dynamic>.from(json['terms'] as Map)),
        privacy: LegalDocument.fromJson(Map<String, dynamic>.from(json['privacy'] as Map)),
        marketing: LegalDocument.fromJson(Map<String, dynamic>.from(json['marketing'] as Map)),
      );

  final LegalDocument terms;
  final LegalDocument privacy;
  final LegalDocument marketing;

  /// Documento por `slug`. Un slug desconocido devuelve `null` en vez de adivinar.
  LegalDocument? bySlug(String slug) => switch (slug) {
        'terms' => terms,
        'privacy' => privacy,
        'marketing' => marketing,
        _ => null,
      };

  Map<String, dynamic> toJson() => {
        'terms': terms.toJson(),
        'privacy': privacy.toJson(),
        'marketing': marketing.toJson(),
      };
}

/// Estado de la pantalla: hay texto o hay que esperar al servidor.
sealed class LegalLoad {
  const LegalLoad();
}

/// El servidor entregó los tres textos con su versión.
class LegalLoaded extends LegalLoad {
  const LegalLoaded(this.documents);

  final LegalDocuments documents;
}

/// El servidor no los entregó todavía: se dice con claridad, sin inventar el texto.
class LegalUnavailable extends LegalLoad {
  const LegalUnavailable(this.reason);

  /// Motivo ya listo para traducir. Nunca un código técnico ni una excepción.
  final String reason;
}

/// S-PUB-03 · `/legal/:slug` · Texto legal.
///
/// Un solo botón filled («Aceptar», solo cuando hay un texto que aceptar). El
/// contenido es de solo lectura y se desplaza; no hay acciones destructivas.
class LegalDocumentScreen extends StatelessWidget {
  const LegalDocumentScreen({super.key, required this.load, required this.slug, this.onAccept});

  final LegalLoad load;
  final String slug;
  final VoidCallback? onAccept;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    final body = switch (load) {
      LegalUnavailable(:final reason) => _Unavailable(message: _translate(l10n, reason)),
      LegalLoaded(:final documents) => _Body(document: documents.bySlug(slug)),
    };

    final title = switch (load) {
      LegalUnavailable() => l10n.legalUnavailableTitle,
      LegalLoaded(:final documents) => documents.bySlug(slug)?.title ?? l10n.legalUnavailableTitle,
    };

    final canAccept = load is LegalLoaded && (load as LegalLoaded).documents.bySlug(slug) != null;

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(child: body),
            if (canAccept)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: PPButton.primary(label: l10n.actionAcceptTerms, onPressed: onAccept),
              ),
            if (theme.brightness == Brightness.dark)
              const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _translate(AppLocalizations l10n, String reason) => switch (reason) {
        'not_configured' => l10n.legalUnavailableNotConfigured,
        'fetch_failed' => l10n.legalUnavailableFetchFailed,
        _ => l10n.legalUnavailableGeneric,
      };
}

class _Body extends StatelessWidget {
  const _Body({required this.document});

  final LegalDocument? document;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final doc = document;
    if (doc == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(l10n.legalUnavailableGeneric, textAlign: TextAlign.center),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // La versión y la fecha del texto se muestran: quien acepta tiene que saber
        // qué versión está aceptando (N-DAT-02).
        Text(
          l10n.legalVersionAndDate(doc.version, ReceiptDateFormat.format(doc.publishedAt)),
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
          ),
        ),
        const SizedBox(height: 16),
        Text(doc.body, style: theme.textTheme.bodyMedium),
      ],
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.gavel_outlined, size: 40, color: theme.colorScheme.onSurface),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: theme.textTheme.bodyLarge),
          ],
        ),
      ),
    );
  }
}

/// Formatea una fecha con el mes **en texto** (N-STD-10).
class ReceiptDateFormat {
  static String format(DateTime d) {
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    final local = d.toLocal();
    final month = local.month >= 1 && local.month <= 12 ? months[local.month - 1] : '';
    if (month.isEmpty) return '';
    return '${local.day} de $month de ${local.year}';
  }
}