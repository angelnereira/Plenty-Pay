import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/features/account/account_screen.dart';

void main() {
  testWidgets('AccountScreen renders title', (tester) async {
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('es','PA'),
      home: AccountScreen(api: ApiClient(baseUrl: 'http://localhost:8080')),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Mi cuenta'), findsOneWidget);
  });
}
