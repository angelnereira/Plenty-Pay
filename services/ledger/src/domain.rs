//! Dominio puro del Ledger. Sin BD, sin red, sin I/O: solo reglas contables.
//! Las invariantes aquí validadas se re-aplican en PostgreSQL con triggers
//! cuando llegue la persistencia (Etapa 2) — defensa en profundidad (§13).

use std::collections::HashMap;

/// Monedas soportadas (ADR-0002). USD y PAB par 1:1. Otras monedas requieren
/// justificación y fuente de tipos documentada — no se inventan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Currency {
    Usd,
    Pab,
}

impl Currency {
    pub fn code(self) -> &'static str {
        match self {
            Currency::Usd => "USD",
            Currency::Pab => "PAB",
        }
    }

    pub fn from_code(code: &str) -> Result<Self, LedgerError> {
        match code {
            "USD" => Ok(Currency::Usd),
            "PAB" => Ok(Currency::Pab),
            other => Err(LedgerError::UnsupportedCurrency(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Direction {
    Debit,
    Credit,
}

impl Direction {
    fn flip(self) -> Self {
        match self {
            Direction::Debit => Direction::Credit,
            Direction::Credit => Direction::Debit,
        }
    }
}

/// Dinero exacto. `minor_units` (centavos) es SIEMPRE >= 0 como monto de
/// entrada; el saldo neto de una cuenta puede ser firmado (ver [`Balance`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Money {
    pub minor_units: i64,
    pub currency: Currency,
}

impl Money {
    pub fn new(minor_units: i64, currency: Currency) -> Result<Self, LedgerError> {
        if minor_units < 0 {
            return Err(LedgerError::NegativeAmount);
        }
        Ok(Money {
            minor_units,
            currency,
        })
    }

    pub fn checked_add(&self, other: &Money) -> Result<Money, LedgerError> {
        if self.currency != other.currency {
            return Err(LedgerError::CurrencyMismatch);
        }
        Ok(Money {
            minor_units: self
                .minor_units
                .checked_add(other.minor_units)
                .ok_or(LedgerError::Overflow)?,
            currency: self.currency,
        })
    }

    pub fn is_zero(&self) -> bool {
        self.minor_units == 0
    }
}

/// Entrada en especificación: lo que el llamador pide asentar (entry_id lo
/// asigna el ledger, nunca el cliente).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntrySpec {
    pub account_id: String,
    pub direction: Direction,
    pub amount: Money,
}

/// Referencia a una transacción ya confirmada.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransactionRef {
    pub transaction_id: String,
    pub idempotency_key: Option<String>,
    pub reverse_of: Option<String>,
}

/// Transacción contable: append-only, con invariantes validadas en construcción.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Transaction {
    pub id: String,
    pub entries: Vec<EntrySpec>,
    pub reverse_of: Option<String>,
    pub idempotency_key: Option<String>,
}

impl Transaction {
    /// Construcción con validación completa de invariantes (mandato §12):
    /// transacción no vacía, ids no vacíos, montos > 0, moneda única,
    /// `SUM(DEBIT) == SUM(CREDIT)` (con aritmética checked).
    pub fn new(
        id: impl Into<String>,
        entries: Vec<EntrySpec>,
        idempotency_key: Option<String>,
    ) -> Result<Self, LedgerError> {
        let id = id.into();
        if id.is_empty() {
            return Err(LedgerError::InvalidTransactionId);
        }
        if entries.is_empty() {
            return Err(LedgerError::EmptyTransaction);
        }

        let currency = entries[0].amount.currency;
        let mut debit = Money {
            minor_units: 0,
            currency,
        };
        let mut credit = Money {
            minor_units: 0,
            currency,
        };

        for e in &entries {
            if e.account_id.trim().is_empty() {
                return Err(LedgerError::InvalidAccount);
            }
            if e.amount.currency != currency {
                return Err(LedgerError::CurrencyMismatch);
            }
            if e.amount.minor_units <= 0 {
                return Err(LedgerError::NonPositiveEntry);
            }
            match e.direction {
                Direction::Debit => debit = debit.checked_add(&e.amount)?,
                Direction::Credit => credit = credit.checked_add(&e.amount)?,
            }
        }

        if debit != credit {
            return Err(LedgerError::Unbalanced {
                debit: debit.minor_units,
                credit: credit.minor_units,
            });
        }

        Ok(Transaction {
            id,
            entries,
            reverse_of: None,
            idempotency_key,
        })
    }

    /// Construye el reverso espejo: mismas partidas, dirección invertida.
    fn mirror_reversal(
        &self,
        reversal_id: impl Into<String>,
        idempotency_key: Option<String>,
    ) -> Result<Transaction, LedgerError> {
        let entries = self
            .entries
            .iter()
            .map(|e| EntrySpec {
                account_id: e.account_id.clone(),
                direction: e.direction.flip(),
                amount: e.amount,
            })
            .collect();
        let mut tx = Transaction::new(reversal_id, entries, idempotency_key)?;
        tx.reverse_of = Some(self.id.clone());
        Ok(tx)
    }
}

/// Saldo neto de una cuenta. Firmado por diseño: ocultarlo con un error
/// sería ocultar un problema contable; la política "wallet no sobregirada"
/// se aplica a nivel del servicio wallet (ADR-0006), no aquí.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Balance {
    pub minor_units: i64, // firmado
    pub currency: Currency,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PostOutcome {
    /// Asentada nueva, con su id.
    Posted(TransactionRef),
    /// Reintento idempotente: ya existía; se devuelve la ORIGINAL. Sin doble asiento.
    Replayed(TransactionRef),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LedgerError {
    NegativeAmount,
    NonPositiveEntry,
    CurrencyMismatch,
    UnsupportedCurrency(String),
    Overflow,
    Unbalanced { debit: i64, credit: i64 },
    EmptyTransaction,
    InvalidAccount,
    InvalidTransactionId,
    DuplicateTransactionId(String),
    UnknownTransaction(String),
    InvalidReversal(String),
}

/// Store append-only en memoria. Es la MISMA semántica que se replicará en
/// PostgreSQL (Etapa 2): INSERT-only, ids únicos, idempotencia por clave,
/// reversos ligados. La capa DB añade: atómica por transacción SQL,
/// trigger de balanceo y REVOKE UPDATE/DELETE.
#[derive(Default)]
pub struct Store {
    transactions: Vec<Transaction>,
    by_id: HashMap<String, usize>,
    by_key: HashMap<String, usize>,
    reversed: HashMap<String, String>, // original_id -> reversal_id (v1: reverso único total)
}

impl Store {
    pub fn new() -> Self {
        Self::default()
    }

    /// Asienta una transacción. Idempotente por `idempotency_key` si viene:
    /// un webhook duplicado de Yappy/TELERED/PSP (doc 03 §10.3) no produce
    /// nunca dos asientos.
    pub fn post(&mut self, tx: Transaction) -> Result<PostOutcome, LedgerError> {
        if let Some(key) = tx.idempotency_key.as_deref() {
            if let Some(&idx) = self.by_key.get(key) {
                return Ok(PostOutcome::Replayed(self.ref_of(idx)));
            }
        }
        if self.by_id.contains_key(&tx.id) {
            return Err(LedgerError::DuplicateTransactionId(tx.id));
        }
        // Invariante defensiva: revalidar en el punto de confirmación.
        let _ = Transaction::new(
            tx.id.clone(),
            tx.entries.clone(),
            tx.idempotency_key.clone(),
        )?;
        // Un reverso solo puede existir si su original existe y no fue compensado.
        if let Some(orig) = tx.reverse_of.as_deref() {
            if !self.by_id.contains_key(orig) {
                return Err(LedgerError::UnknownTransaction(orig.to_string()));
            }
            if self.reversed.contains_key(orig) {
                return Err(LedgerError::InvalidReversal(format!(
                    "transacción {orig} ya tiene reverso registrado"
                )));
            }
        }
        let idx = self.transactions.len();
        if let Some(key) = tx.idempotency_key.clone() {
            self.by_key.insert(key, idx);
        }
        self.by_id.insert(tx.id.clone(), idx);
        self.transactions.push(tx);
        Ok(PostOutcome::Posted(self.ref_of(idx)))
    }

    /// Reverso explícito de una partida ORIGINAL (v1: reverso total, único).
    /// La original no se modifica — se añade una nueva ligada a ella
    /// (`reverse_of`), con el rastro de ambas (doc 00 §3.2).
    pub fn reverse(
        &mut self,
        original_id: &str,
        reversal_id: impl Into<String>,
        idempotency_key: Option<String>,
    ) -> Result<PostOutcome, LedgerError> {
        if self.reversed.contains_key(original_id) {
            return Err(LedgerError::InvalidReversal(format!(
                "transacción {original_id} ya tiene reverso registrado"
            )));
        }
        let reversal = {
            let idx = *self
                .by_id
                .get(original_id)
                .ok_or_else(|| LedgerError::UnknownTransaction(original_id.to_string()))?;
            let original = self.transactions[idx].clone();
            original.mirror_reversal(reversal_id, idempotency_key)?
        };
        match self.post(reversal)? {
            PostOutcome::Posted(reversal_ref) => {
                self.reversed
                    .insert(original_id.to_string(), reversal_ref.transaction_id.clone());
                Ok(PostOutcome::Posted(reversal_ref))
            }
            // La clave del reverso colisiona con algo previo: es idempotencia
            // de red legítima; devolver el original sin marcar `reversed`.
            PostOutcome::Replayed(existing) => Ok(PostOutcome::Replayed(existing)),
        }
    }

    pub fn transaction(&self, transaction_id: &str) -> Option<&Transaction> {
        self.by_id
            .get(transaction_id)
            .map(|&i| &self.transactions[i])
    }

    /// Saldo por cuenta: SUM(credit) - SUM(debit) sobre TODAS las partidas
    /// (incluye reversos, porque el reverso es una transacción normal).
    pub fn balance(&self, account_id: &str) -> Option<Balance> {
        let mut net: i64 = 0;
        let mut currency: Option<Currency> = None;
        for tx in &self.transactions {
            for e in &tx.entries {
                if e.account_id != account_id {
                    continue;
                }
                match currency {
                    None => currency = Some(e.amount.currency),
                    Some(c) if c != e.amount.currency => return None, // cuenta mono-moneda por diseño
                    _ => {}
                }
                match e.direction {
                    Direction::Credit => net = net.checked_add(e.amount.minor_units)?,
                    Direction::Debit => net = net.checked_sub(e.amount.minor_units)?,
                }
            }
        }
        currency.map(|c| Balance {
            minor_units: net,
            currency: c,
        })
    }

    pub fn transaction_count(&self) -> usize {
        self.transactions.len()
    }

    fn ref_of(&self, idx: usize) -> TransactionRef {
        let t = &self.transactions[idx];
        TransactionRef {
            transaction_id: t.id.clone(),
            idempotency_key: t.idempotency_key.clone(),
            reverse_of: t.reverse_of.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const USD: Currency = Currency::Usd;

    fn usd(units: i64) -> Money {
        Money::new(units, USD).unwrap()
    }

    fn entries_debit_credit(debit_acc: &str, credit_acc: &str, amount: Money) -> Vec<EntrySpec> {
        vec![
            EntrySpec {
                account_id: debit_acc.into(),
                direction: Direction::Debit,
                amount,
            },
            EntrySpec {
                account_id: credit_acc.into(),
                direction: Direction::Credit,
                amount,
            },
        ]
    }

    #[test]
    fn money_rejects_negative() {
        assert_eq!(
            Money::new(-1, USD).unwrap_err(),
            LedgerError::NegativeAmount
        );
    }

    #[test]
    fn money_checked_ops_guard_overflow() {
        let a = Money {
            minor_units: i64::MAX,
            currency: USD,
        };
        let b = Money {
            minor_units: 1,
            currency: USD,
        };
        assert_eq!(a.checked_add(&b).unwrap_err(), LedgerError::Overflow);
    }

    #[test]
    fn unsupported_currency_rejected() {
        assert!(Currency::from_code("EUR").is_err());
        assert!(Currency::from_code("USD").is_ok());
        assert!(Currency::from_code("PAB").is_ok());
    }

    #[test]
    fn balanced_transaction_accepted() {
        let tx = Transaction::new(
            "tx-1",
            entries_debit_credit("wallet_a", "merchant", usd(1000)),
            Some("idem-1".into()),
        )
        .unwrap();
        assert_eq!(tx.entries.len(), 2);
        assert_eq!(tx.entries[0].amount.minor_units, 1000);
    }

    #[test]
    fn unbalanced_transaction_rejected() {
        let entries = vec![
            EntrySpec {
                account_id: "a".into(),
                direction: Direction::Debit,
                amount: usd(1000),
            },
            EntrySpec {
                account_id: "b".into(),
                direction: Direction::Credit,
                amount: usd(999),
            },
        ];
        assert!(matches!(
            Transaction::new("tx", entries, None),
            Err(LedgerError::Unbalanced {
                debit: 1000,
                credit: 999
            })
        ));
    }

    #[test]
    fn mixed_currency_transaction_rejected() {
        let entries = vec![
            EntrySpec {
                account_id: "a".into(),
                direction: Direction::Debit,
                amount: usd(100),
            },
            EntrySpec {
                account_id: "b".into(),
                direction: Direction::Credit,
                amount: Money::new(100, Currency::Pab).unwrap(),
            },
        ];
        assert_eq!(
            Transaction::new("tx", entries, None).unwrap_err(),
            LedgerError::CurrencyMismatch
        );
    }

    #[test]
    fn empty_and_invalid_transactions_rejected() {
        assert!(Transaction::new("tx", vec![], None).is_err());
        let entries = entries_debit_credit("a", "b", usd(1));
        assert!(Transaction::new("", entries, None).is_err());
    }

    #[test]
    fn post_and_balance_are_exact() {
        let mut s = Store::new();
        let tx = Transaction::new(
            "tx-1",
            entries_debit_credit("wallet_1", "merchant_clearing", usd(2500)),
            Some("idem-1".into()),
        )
        .unwrap();
        s.post(tx).unwrap();

        assert_eq!(s.balance("wallet_1").unwrap().minor_units, -2500);
        assert_eq!(s.balance("merchant_clearing").unwrap().minor_units, 2500);
        assert_eq!(s.balance("inexistente"), None);
    }

    #[test]
    fn idempotent_replay_never_double_posts() {
        // doc 03 §10.3: webhook duplicado no genera dos entries.
        let mut s = Store::new();
        let make = || {
            Transaction::new(
                "tx-webhook",
                entries_debit_credit("wallet_1", "merchant", usd(500)),
                Some("yappy-webhook-key".into()),
            )
            .unwrap()
        };
        let first = s.post(make()).unwrap();
        let second = s.post(make()).unwrap();

        assert!(matches!(first, PostOutcome::Posted(_)));
        assert!(matches!(second, PostOutcome::Replayed(_)));
        // Ambos refieren a la MISMA transacción original; jamás un segundo asiento.
        assert_eq!(outcome_id(&second), outcome_id(&first));
        assert_eq!(s.transaction_count(), 1); // UN solo asiento
        assert_eq!(s.balance("merchant").unwrap().minor_units, 500);
    }

    #[test]
    fn distinct_keys_same_rejection_paths() {
        let mut s = Store::new();
        let tx = Transaction::new(
            "tx-1",
            entries_debit_credit("a", "b", usd(10)),
            Some("k1".into()),
        )
        .unwrap();
        s.post(tx).unwrap();

        // mismo id, otra clave → duplicado de id rechazado (no silencioso)
        let tx2 = Transaction::new(
            "tx-1",
            entries_debit_credit("a", "b", usd(10)),
            Some("k2".into()),
        )
        .unwrap();
        assert_eq!(
            s.post(tx2).unwrap_err(),
            LedgerError::DuplicateTransactionId("tx-1".into())
        );
    }

    #[test]
    fn reversal_nets_to_zero_and_preserves_original() {
        let mut s = Store::new();
        let tx = Transaction::new(
            "tx-1",
            entries_debit_credit("wallet_1", "merchant", usd(1000)),
            Some("idem-1".into()),
        )
        .unwrap();
        s.post(tx).unwrap();

        let out = s.reverse("tx-1", "rev-1", Some("idem-rev".into())).unwrap();
        let rev = match out {
            PostOutcome::Posted(r) => r,
            _ => panic!("reverso debe postearse"),
        };
        assert_eq!(rev.reverse_of.as_deref(), Some("tx-1"));

        // Efecto neto global: cero en todas las cuentas.
        assert_eq!(s.balance("wallet_1").unwrap().minor_units, 0);
        assert_eq!(s.balance("merchant").unwrap().minor_units, 0);

        // La original sigue intacta y consultable (append-only).
        let original = s.transaction("tx-1").unwrap();
        assert_eq!(original.entries.len(), 2);
        assert_eq!(original.reverse_of, None);
        assert!(s.transaction("rev-1").unwrap().reverse_of == Some("tx-1".into()));
        assert_eq!(s.transaction_count(), 2);
    }

    #[test]
    fn double_reversal_rejected() {
        // V1: reverso total único — dos reversos = doble reembolso = prohibido.
        let mut s = Store::new();
        let tx = Transaction::new("tx-1", entries_debit_credit("a", "b", usd(100)), None).unwrap();
        s.post(tx).unwrap();
        s.reverse("tx-1", "rev-1", None).unwrap();

        assert!(matches!(
            s.reverse("tx-1", "rev-2", None),
            Err(LedgerError::InvalidReversal(_))
        ));
    }

    #[test]
    fn reversal_of_unknown_transaction_rejected() {
        let mut s = Store::new();
        assert!(matches!(
            s.reverse("fantasma", "rev-x", None),
            Err(LedgerError::UnknownTransaction(_))
        ));
    }

    fn outcome_id(o: &PostOutcome) -> &str {
        match o {
            PostOutcome::Posted(r) | PostOutcome::Replayed(r) => &r.transaction_id,
        }
    }

    #[test]
    fn post_with_unknown_reverse_of_rejected() {
        // Un asiento no puede referenciar un original inexistente (defensa
        // contra llamadas malformadas; en DB será FK, Etapa 2).
        let mut s = Store::new();
        let mut tx = Transaction::new(
            "rev-fantasma",
            entries_debit_credit("a", "b", usd(10)),
            None,
        )
        .unwrap();
        tx.reverse_of = Some("no-existe".into());
        assert!(matches!(
            s.post(tx),
            Err(LedgerError::UnknownTransaction(_))
        ));
    }

    #[test]
    fn multi_account_multi_transaction_balances() {
        let mut s = Store::new();
        // Venta: cliente paga 1000 → merchant 900 + plataforma fee 100 (doc 00 §3.2 split).
        let tx1 = Transaction::new(
            "sale-1",
            vec![
                EntrySpec {
                    account_id: "wallet_client".into(),
                    direction: Direction::Debit,
                    amount: usd(1000),
                },
                EntrySpec {
                    account_id: "merchant_clearing".into(),
                    direction: Direction::Credit,
                    amount: usd(900),
                },
                EntrySpec {
                    account_id: "platform_fee".into(),
                    direction: Direction::Credit,
                    amount: usd(100),
                },
            ],
            Some("sale-k".into()),
        )
        .unwrap();
        s.post(tx1).unwrap();

        // Devolución parcial: reverso del fee no aplica (v1 reverso total);
        // corrección = asiento nuevo.
        let tx2 = Transaction::new(
            "sale-1-correction",
            vec![
                EntrySpec {
                    account_id: "platform_fee".into(),
                    direction: Direction::Debit,
                    amount: usd(50),
                },
                EntrySpec {
                    account_id: "merchant_clearing".into(),
                    direction: Direction::Credit,
                    amount: usd(50),
                },
            ],
            Some("corr-k".into()),
        )
        .unwrap();
        s.post(tx2).unwrap();

        assert_eq!(s.balance("wallet_client").unwrap().minor_units, -1000);
        assert_eq!(s.balance("merchant_clearing").unwrap().minor_units, 950);
        assert_eq!(s.balance("platform_fee").unwrap().minor_units, 50);
    }
}
