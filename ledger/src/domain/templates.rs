//! Plantillas de asiento (domain-model.md §5.2) y validación de una transacción (I1, I2, R8,
//! R12, R13). Puro: sin I/O.

use std::collections::HashSet;

use crate::domain::accounts::{AccountType, Side, PLATFORM_PARTY};
use crate::domain::errors::DomainError;

/// Monto máximo por asiento (R12: protección de overflow).
pub const MAX_AMOUNT_MINOR: i64 = 1_000_000_000_000_000;

/// Un asiento propuesto: cuenta (party, tipo, moneda, scope), lado y monto.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntrySpec {
    pub party_id: String,
    pub account_type: AccountType,
    pub currency: String,
    pub scope_id: String,
    pub side: Side,
    pub amount_minor: i64,
}

/// Forma de una plantilla: qué (tipo de cuenta, lado) admite.
struct Shape {
    transaction_type: &'static str,
    debits: &'static [AccountType],
    credits: &'static [AccountType],
}

use AccountType::*;

const SHAPES: &[Shape] = &[
    Shape {
        transaction_type: "WALLET_TOPUP",
        debits: &[RailReceivable],
        credits: &[Wallet],
    },
    Shape {
        transaction_type: "PAYMENT_CAPTURE",
        debits: &[RailReceivable],
        credits: &[MerchantPayable, PlatformFees, TaxPayable, RailFeesPayable],
    },
    Shape {
        transaction_type: "WALLET_PAYMENT",
        debits: &[Wallet],
        credits: &[MerchantPayable, PlatformFees, TaxPayable],
    },
    Shape {
        transaction_type: "P2P_TRANSFER",
        debits: &[Wallet],
        credits: &[Wallet],
    },
    Shape {
        transaction_type: "RAIL_SETTLEMENT",
        debits: &[BankCash, RailFeesPayable],
        credits: &[RailReceivable],
    },
    Shape {
        transaction_type: "PAYOUT",
        debits: &[MerchantPayable],
        credits: &[BankCash],
    },
    Shape {
        transaction_type: "PAYOUT_TO_WALLET",
        debits: &[MerchantPayable],
        credits: &[Wallet],
    },
    Shape {
        transaction_type: "REFUND",
        debits: &[MerchantPayable, PlatformFees, TaxPayable, RailFeesPayable],
        credits: &[RailReceivable, Wallet],
    },
    Shape {
        transaction_type: "LOYALTY_ISSUE",
        debits: &[LoyaltyPoints],
        credits: &[LoyaltyPoints],
    },
    Shape {
        transaction_type: "LOYALTY_REDEEM",
        debits: &[LoyaltyPoints],
        credits: &[LoyaltyPoints],
    },
    Shape {
        transaction_type: "CREDIT_SALE",
        debits: &[CustomerCredit],
        credits: &[CustomerCredit],
    },
    Shape {
        transaction_type: "CREDIT_REPAYMENT",
        debits: &[CustomerCredit],
        credits: &[CustomerCredit],
    },
    Shape {
        transaction_type: "PAYROLL_PAYMENT",
        debits: &[Wallet],
        credits: &[Wallet],
    },
];

/// Tipo que crea ReverseTransaction; nunca se acepta en PostTransaction.
pub const REVERSAL: &str = "REVERSAL";

/// Tipos de una captura de pago: una sola por referencia (R5, índice `one_capture_per_payment`).
pub fn is_capture(transaction_type: &str) -> bool {
    matches!(transaction_type, "PAYMENT_CAPTURE" | "WALLET_PAYMENT")
}

/// Valida una transacción contra su plantilla (R8) e invariantes I1, I2 y R12.
pub fn validate(
    transaction_type: &str,
    currency: &str,
    entries: &[EntrySpec],
) -> Result<(), DomainError> {
    let shape = SHAPES
        .iter()
        .find(|s| s.transaction_type == transaction_type)
        .ok_or(DomainError::UnknownTemplate)?;
    validate_currency(currency)?;
    if entries.len() < 2 {
        return Err(DomainError::Unbalanced);
    }
    let mut debits: i128 = 0;
    let mut credits: i128 = 0;
    let mut seen_debit = false;
    let mut seen_credit = false;
    for e in entries {
        validate_entry(e, currency)?;
        let allowed = match e.side {
            Side::Debit => shape.debits,
            Side::Credit => shape.credits,
        };
        if !allowed.contains(&e.account_type) {
            return Err(DomainError::TemplateShapeMismatch);
        }
        match e.side {
            Side::Debit => {
                seen_debit = true;
                debits = debits
                    .checked_add(i128::from(e.amount_minor))
                    .ok_or(DomainError::Overflow)?;
            }
            Side::Credit => {
                seen_credit = true;
                credits = credits
                    .checked_add(i128::from(e.amount_minor))
                    .ok_or(DomainError::Overflow)?;
            }
        }
    }
    if !seen_debit || !seen_credit || debits != credits {
        return Err(DomainError::Unbalanced);
    }
    // Puntos de lealtad viajan en su propia moneda (PTS); el resto, nunca.
    let points = matches!(transaction_type, "LOYALTY_ISSUE" | "LOYALTY_REDEEM");
    if points != (currency == "PTS") {
        return Err(DomainError::CurrencyMismatch);
    }
    Ok(())
}

/// Valida un asiento suelto: monto (I2, R12), moneda, party y cuentas de plataforma.
pub fn validate_entry(e: &EntrySpec, currency: &str) -> Result<(), DomainError> {
    if e.amount_minor <= 0 || e.amount_minor > MAX_AMOUNT_MINOR {
        return Err(DomainError::InvalidAmount);
    }
    if e.currency != currency {
        return Err(DomainError::CurrencyMismatch);
    }
    if uuid_like(&e.party_id).is_none() {
        return Err(DomainError::InvalidParty);
    }
    if e.account_type.platform_only() && e.party_id != PLATFORM_PARTY {
        return Err(DomainError::PlatformAccountForParty);
    }
    Ok(())
}

/// Moneda: 3 letras mayúsculas (ISO 4217) o la moneda de puntos `PTS`.
pub fn validate_currency(currency: &str) -> Result<(), DomainError> {
    if currency.len() == 3 && currency.bytes().all(|b| b.is_ascii_uppercase()) {
        Ok(())
    } else {
        Err(DomainError::InvalidCurrency)
    }
}

/// Ventana de `effective_at` (R13): ≤ 5 min en el futuro y ≤ 35 días en el pasado. Recibe
/// segundos relativos a ahora para mantener el dominio sin reloj.
pub fn validate_effective_offset(offset_seconds: i64) -> Result<(), DomainError> {
    const FUTURE: i64 = 5 * 60;
    const PAST: i64 = 35 * 24 * 3600;
    if !(-PAST..=FUTURE).contains(&offset_seconds) {
        return Err(DomainError::EffectiveAtOutOfRange);
    }
    Ok(())
}

/// Asientos espejo de un reverso (lados invertidos, mismos montos).
pub fn mirror(entries: &[EntrySpec]) -> Vec<EntrySpec> {
    entries
        .iter()
        .map(|e| EntrySpec {
            side: e.side.opposite(),
            ..e.clone()
        })
        .collect()
}

/// Cuentas distintas de una transacción, en orden estable (para bloquear en orden, R7).
pub fn distinct_accounts(entries: &[EntrySpec]) -> Vec<(String, AccountType, String, String)> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for e in entries {
        let k = (
            e.party_id.clone(),
            e.account_type,
            e.currency.clone(),
            e.scope_id.clone(),
        );
        if seen.insert(k.clone()) {
            out.push(k);
        }
    }
    out
}

fn uuid_like(s: &str) -> Option<()> {
    let b = s.as_bytes();
    if b.len() != 36 {
        return None;
    }
    for (i, c) in b.iter().enumerate() {
        let dash = matches!(i, 8 | 13 | 18 | 23);
        if dash != (*c == b'-') || (!dash && !c.is_ascii_hexdigit()) {
            return None;
        }
    }
    Some(())
}

#[cfg(test)]
#[allow(clippy::indexing_slicing)]
mod tests {
    use super::*;

    const U1: &str = "0b6f8f1e-0000-7000-8000-000000000001";
    const U2: &str = "0b6f8f1e-0000-7000-8000-000000000002";
    const M: &str = "0b6f8f1e-0000-7000-8000-00000000000a";

    fn e(party: &str, t: AccountType, side: Side, amount: i64) -> EntrySpec {
        EntrySpec {
            party_id: party.into(),
            account_type: t,
            currency: "USD".into(),
            scope_id: String::new(),
            side,
            amount_minor: amount,
        }
    }

    #[test]
    fn r8_t3_wallet_payment_valid() {
        let entries = [
            e(U1, Wallet, Side::Debit, 1000),
            e(M, MerchantPayable, Side::Credit, 935),
            e(PLATFORM_PARTY, PlatformFees, Side::Credit, 50),
            e(PLATFORM_PARTY, TaxPayable, Side::Credit, 15),
        ];
        assert_eq!(validate("WALLET_PAYMENT", "USD", &entries), Ok(()));
    }

    #[test]
    fn r1_unbalanced_rejected() {
        let entries = [
            e(U1, Wallet, Side::Debit, 1000),
            e(U2, Wallet, Side::Credit, 999),
        ];
        assert_eq!(
            validate("P2P_TRANSFER", "USD", &entries),
            Err(DomainError::Unbalanced)
        );
    }

    #[test]
    fn r8_shape_mismatch_rejected() {
        // Un P2P no puede acreditar comisiones de plataforma.
        let entries = [
            e(U1, Wallet, Side::Debit, 10),
            e(PLATFORM_PARTY, PlatformFees, Side::Credit, 10),
        ];
        assert_eq!(
            validate("P2P_TRANSFER", "USD", &entries),
            Err(DomainError::TemplateShapeMismatch)
        );
    }

    #[test]
    fn r8_unknown_and_reversal_template_rejected() {
        let entries = [
            e(U1, Wallet, Side::Debit, 10),
            e(U2, Wallet, Side::Credit, 10),
        ];
        assert_eq!(
            validate("INVENTADO", "USD", &entries),
            Err(DomainError::UnknownTemplate)
        );
        assert_eq!(
            validate(REVERSAL, "USD", &entries),
            Err(DomainError::UnknownTemplate)
        );
    }

    #[test]
    fn r2_r12_amount_bounds() {
        let zero = [
            e(U1, Wallet, Side::Debit, 0),
            e(U2, Wallet, Side::Credit, 0),
        ];
        assert_eq!(
            validate("P2P_TRANSFER", "USD", &zero),
            Err(DomainError::InvalidAmount)
        );
        let huge = [
            e(U1, Wallet, Side::Debit, MAX_AMOUNT_MINOR + 1),
            e(U2, Wallet, Side::Credit, MAX_AMOUNT_MINOR + 1),
        ];
        assert_eq!(
            validate("P2P_TRANSFER", "USD", &huge),
            Err(DomainError::InvalidAmount)
        );
    }

    #[test]
    fn platform_accounts_only_for_platform_party_and_invalid_party_rejected() {
        let entries = [
            e(U1, Wallet, Side::Debit, 10),
            e(M, PlatformFees, Side::Credit, 10),
        ];
        assert_eq!(
            validate("WALLET_PAYMENT", "USD", &entries),
            Err(DomainError::PlatformAccountForParty)
        );
        let bad = [
            e("PLATFORM", Wallet, Side::Debit, 10),
            e(U2, Wallet, Side::Credit, 10),
        ];
        assert_eq!(
            validate("P2P_TRANSFER", "USD", &bad),
            Err(DomainError::InvalidParty)
        );
    }

    #[test]
    fn i1_currency_per_transaction_and_points_currency() {
        let mut entries = vec![
            e(U1, Wallet, Side::Debit, 10),
            e(U2, Wallet, Side::Credit, 10),
        ];
        entries[1].currency = "PAB".into();
        assert_eq!(
            validate("P2P_TRANSFER", "USD", &entries),
            Err(DomainError::CurrencyMismatch)
        );
        let pts = [
            EntrySpec {
                currency: "PTS".into(),
                scope_id: M.into(),
                ..e(M, LoyaltyPoints, Side::Debit, 5)
            },
            EntrySpec {
                currency: "PTS".into(),
                scope_id: M.into(),
                ..e(U1, LoyaltyPoints, Side::Credit, 5)
            },
        ];
        assert_eq!(validate("LOYALTY_ISSUE", "PTS", &pts), Ok(()));
        assert_eq!(
            validate(
                "LOYALTY_ISSUE",
                "USD",
                &[
                    e(U1, Wallet, Side::Debit, 1),
                    e(U2, Wallet, Side::Credit, 1)
                ]
            ),
            Err(DomainError::TemplateShapeMismatch)
        );
    }

    #[test]
    fn r13_effective_window() {
        assert_eq!(validate_effective_offset(0), Ok(()));
        assert_eq!(
            validate_effective_offset(301),
            Err(DomainError::EffectiveAtOutOfRange)
        );
        assert_eq!(
            validate_effective_offset(-36 * 24 * 3600),
            Err(DomainError::EffectiveAtOutOfRange)
        );
    }

    #[test]
    fn r3_mirror_inverts_sides() {
        let entries = [
            e(U1, Wallet, Side::Debit, 10),
            e(U2, Wallet, Side::Credit, 10),
        ];
        let m = mirror(&entries);
        assert_eq!(m.first().map(|x| x.side), Some(Side::Credit));
        assert_eq!(m.get(1).map(|x| x.side), Some(Side::Debit));
    }
}
