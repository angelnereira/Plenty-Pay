import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/l10n/generated/app_localizations.dart';
import '../../core/layout/window_class.dart';
import '../../core/observability/app_logger.dart' show newRequestId;
import '../../core/theme/tokens.dart';
import '../../core/widgets/async_view.dart';
import '../../core/widgets/money_text.dart';
import '../../core/widgets/pp_button.dart';
import '../../core/widgets/pp_text_field.dart';
import '../business/step_up_flow.dart';
import 'settlement_data.dart';

/// S-FIN-06 · `/finance/payout-settings` · Calendario y cuenta de destino.
/// `settlement:schedule:manage` · 🔒 al cambiar el destino (S-GEN-21, `settlement.destination.update`).
///
/// e1 frecuencia · e2 mínimo · e3 destino · e4 cuenta (guardada: solo banco, tipo, últimos 4 y
/// titular; el número se escribe una vez y no vuelve) · e5 aviso de 48 h (R5) · e6 Guardar.
class PayoutSettingsScreen extends StatefulWidget {
  const PayoutSettingsScreen({super.key, required this.api});
  final ApiClient api;

  @override
  State<PayoutSettingsScreen> createState() => _PayoutSettingsScreenState();
}

class _PayoutSettingsScreenState extends State<PayoutSettingsScreen> {
  late Future<PayoutScheduleItem> _future = _load();
  final _minimum = TextEditingController();
  final _bank = TextEditingController();
  final _number = TextEditingController();
  final _holder = TextEditingController();
  String _frequency = 'PAYOUT_FREQUENCY_MANUAL';
  int _weekday = 5;
  String _destination = 'WALLET';
  String _accountType = 'CHECKING';
  bool _changeAccount = false;
  bool _filled = false;
  bool _saving = false;
  String? _error;
  String? _required;
  String _key = newRequestId();

  Future<PayoutScheduleItem> _load() async =>
      PayoutScheduleItem.fromJson(await widget.api.payoutSchedule());

  void _fill(PayoutScheduleItem s) {
    if (_filled) return;
    _filled = true;
    _frequency = s.frequency;
    _weekday = s.weekday == 0 ? 5 : s.weekday;
    _destination = s.destinationKind;
    _minimum.text = MoneyText.format(s.minimumMinor, symbol: '');
  }

  @override
  void dispose() {
    for (final c in [_minimum, _bank, _number, _holder]) {
      c.dispose();
    }
    super.dispose();
  }

  /// ¿Se manda un destino nuevo? Cambia el tipo, o se pide otra cuenta bancaria.
  bool _destinationChanged(PayoutScheduleItem s) =>
      _destination != s.destinationKind ||
      (_destination == 'BANK' && (_changeAccount || s.last4.isEmpty));

  Future<void> _save(PayoutScheduleItem s) async {
    final l10n = AppLocalizations.of(context);
    final minimum =
        MoneyText.parse(_minimum.text.isEmpty ? '0' : _minimum.text);
    final changed = _destinationChanged(s);
    final needsAccount = changed && _destination == 'BANK';
    setState(() {
      _error = null;
      _required = (minimum == null) ||
              (needsAccount &&
                  [_bank, _number, _holder].any((c) => c.text.trim().isEmpty))
          ? l10n.fiscalFieldRequired
          : null;
    });
    if (_required != null) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    Future<Map<String, dynamic>> run(String? token) =>
        widget.api.setPayoutSchedule(
          {
            'frequency': _frequency,
            if (_frequency == 'PAYOUT_FREQUENCY_WEEKLY') 'weekday': _weekday,
            'minimum_payout_minor': '$minimum',
          },
          destination: changed
              ? {
                  'kind': _destination,
                  if (_destination == 'BANK') ...{
                    'bank': _bank.text.trim(),
                    'account_type': _accountType,
                    'account_number': _number.text.trim(),
                    'holder_name': _holder.text.trim(),
                  },
                }
              : null,
          idempotencyKey: _key,
          stepUpToken: token,
        );
    try {
      final saved = changed
          ? await runWithStepUp<Map<String, dynamic>>(context,
              api: widget.api,
              operation: 'settlement.destination.update',
              title: l10n.payoutSettingsTitle,
              run: run)
          : await run(null);
      if (saved == null || !mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(l10n.payoutSettingsSaved)));
      setState(() {
        _key = newRequestId();
        _filled = false;
        _changeAccount = false;
        for (final c in [_bank, _number, _holder]) {
          c.clear();
        }
        _future = _load();
      });
    } on Object catch (e) {
      if (mounted) setState(() => _error = settlementErrorMessage(l10n, e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  List<Widget> _account(
      PayoutScheduleItem s, AppLocalizations l10n, ThemeData theme) {
    if (_destination != 'BANK') return const [];
    if (s.isBank && s.last4.isNotEmpty && !_changeAccount) {
      return [
        const SizedBox(height: AppTokens.spacingSm),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.account_balance_outlined),
          title: Text(s.bank),
          subtitle: Text([
            s.accountType == 'SAVINGS'
                ? l10n.payoutAccountSavings
                : l10n.payoutAccountChecking,
            '•••• ${s.last4}',
            s.holder,
          ].join(' · ')),
        ),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: TextButton(
              onPressed: () => setState(() => _changeAccount = true),
              child: Text(l10n.payoutChangeAccount)),
        ),
      ];
    }
    String? req(TextEditingController c) =>
        c.text.trim().isEmpty ? _required : null;
    return [
      const SizedBox(height: AppTokens.spacingSm),
      PPTextField(
          controller: _bank, labelText: l10n.payoutBank, error: req(_bank)),
      const SizedBox(height: AppTokens.spacingSm),
      SegmentedButton<String>(
        segments: [
          ButtonSegment(
              value: 'CHECKING', label: Text(l10n.payoutAccountChecking)),
          ButtonSegment(
              value: 'SAVINGS', label: Text(l10n.payoutAccountSavings)),
        ],
        selected: {_accountType},
        onSelectionChanged: (v) => setState(() => _accountType = v.first),
      ),
      const SizedBox(height: AppTokens.spacingSm),
      PPTextField(
          controller: _number,
          labelText: l10n.payoutAccountNumber,
          keyboardType: TextInputType.number,
          error: req(_number)),
      const SizedBox(height: AppTokens.spacingSm),
      PPTextField(
          controller: _holder,
          labelText: l10n.payoutHolder,
          error: req(_holder)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final margin = WindowClass.of(context).horizontalMargin;
    final weekdays = [
      l10n.weekdayMonday,
      l10n.weekdayTuesday,
      l10n.weekdayWednesday,
      l10n.weekdayThursday,
      l10n.weekdayFriday,
      l10n.weekdaySaturday,
      l10n.weekdaySunday,
    ];
    return Scaffold(
      appBar: AppBar(title: Text(l10n.payoutSettingsTitle)),
      body: FutureBuilder<PayoutScheduleItem>(
        future: _future,
        builder: (context, snap) => ListView(
          padding: EdgeInsets.fromLTRB(
              margin, AppTokens.spacingMd, margin, AppTokens.spacingXl),
          children: [
            AsyncView<PayoutScheduleItem>(
              snapshot: snap,
              errorMessage: snap.hasError
                  ? settlementErrorMessage(l10n, snap.error!)
                  : l10n.errorNoConnection,
              retryLabel: l10n.actionRetry,
              onRetry: () => setState(() {
                _future = _load();
              }),
              emptyView: const SizedBox.shrink(),
              builder: (context, s) {
                _fill(s);
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // e1
                    Text(l10n.payoutFrequency,
                        style: theme.textTheme.titleSmall),
                    RadioGroup<String>(
                      groupValue: _frequency,
                      onChanged: (v) =>
                          setState(() => _frequency = v ?? _frequency),
                      child: Column(children: [
                        for (final (value, label) in [
                          ('PAYOUT_FREQUENCY_DAILY', l10n.payoutDaily),
                          ('PAYOUT_FREQUENCY_WEEKLY', l10n.payoutWeekly),
                          ('PAYOUT_FREQUENCY_MANUAL', l10n.payoutManual),
                        ])
                          RadioListTile<String>(
                              value: value,
                              title: Text(label),
                              contentPadding: EdgeInsets.zero),
                      ]),
                    ),
                    if (_frequency == 'PAYOUT_FREQUENCY_WEEKLY')
                      DropdownButtonFormField<int>(
                        initialValue: _weekday,
                        isExpanded: true,
                        decoration:
                            InputDecoration(labelText: l10n.payoutWeekday),
                        items: [
                          for (var i = 0; i < weekdays.length; i++)
                            DropdownMenuItem(
                                value: i + 1, child: Text(weekdays[i])),
                        ],
                        onChanged: (v) =>
                            setState(() => _weekday = v ?? _weekday),
                      ),
                    if (_frequency != 'PAYOUT_FREQUENCY_MANUAL')
                      Padding(
                        padding:
                            const EdgeInsets.only(top: AppTokens.spacingXs),
                        child: Text(l10n.payoutCutoffHint,
                            style: theme.textTheme.bodySmall),
                      ),
                    const SizedBox(height: AppTokens.spacingMd),
                    // e2
                    PPTextField(
                      controller: _minimum,
                      labelText: l10n.payoutMinimum,
                      prefixText: r'$ ',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      error: MoneyText.parse(_minimum.text.isEmpty
                                  ? '0'
                                  : _minimum.text) ==
                              null
                          ? _required
                          : null,
                    ),
                    const SizedBox(height: AppTokens.spacingLg),
                    // e3
                    Text(l10n.payoutDestination,
                        style: theme.textTheme.titleSmall),
                    const SizedBox(height: AppTokens.spacingXs),
                    SegmentedButton<String>(
                      segments: [
                        ButtonSegment(
                            value: 'BANK',
                            label: Text(l10n.payoutDestinationBank)),
                        ButtonSegment(
                            value: 'WALLET',
                            label: Text(l10n.payoutDestinationWallet)),
                      ],
                      selected: {_destination},
                      onSelectionChanged: (v) =>
                          setState(() => _destination = v.first),
                    ),
                    // e4
                    ..._account(s, l10n, theme),
                    // e5
                    const SizedBox(height: AppTokens.spacingMd),
                    Text(
                      s.blockedUntil != null &&
                              s.blockedUntil!.isAfter(DateTime.now())
                          ? l10n.payoutBlockedUntil(
                              settlementDateTime(s.blockedUntil!, locale))
                          : l10n.payoutChangeNotice,
                      style: theme.textTheme.bodyMedium,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: AppTokens.spacingMd),
                      Text(_error!,
                          style: TextStyle(color: theme.colorScheme.error)),
                    ],
                    const SizedBox(height: AppTokens.spacingLg),
                    // e6
                    PPButton.primary(
                        label: l10n.actionSave,
                        onPressed: _saving ? null : () => _save(s)),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
