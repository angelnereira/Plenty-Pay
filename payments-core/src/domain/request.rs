//! Validación de entradas que no depende de datos guardados (SPEC §4, §11; grpc-conventions §3).

use crate::domain::errors::DomainError;

/// Monedas aceptadas en el MVP y sus decimales ISO 4217 (domain-model §10.1, N-STD-02).
const CURRENCIES: &[(&str, u8)] = &[("USD", 2), ("PAB", 2)];

/// `common.Reference.type` permitidos (domain-model §9).
const REFERENCE_TYPES: &[&str] = &[
    "payment",
    "payment_intent",
    "refund",
    "sale",
    "order",
    "sub_order",
    "invoice",
    "settlement_batch",
    "payroll_run",
    "payslip",
    "delivery",
    "purchase_order",
    "transfer",
    "topup",
    "terminal",
    "cash_session",
    "stock_movement",
];

/// Claves de `metadata` que delatarían datos sensibles (SPEC §11, N-PAG-01).
const FORBIDDEN_METADATA: &[&str] = &["card", "cvv", "pan", "password", "pin"];

pub const MAX_METADATA_KEYS: usize = 20;
pub const MAX_METADATA_CHARS: usize = 500;

pub fn currency_decimals(code: &str) -> Result<u8, DomainError> {
    CURRENCIES
        .iter()
        .find(|(c, _)| *c == code)
        .map(|(_, d)| *d)
        .ok_or(DomainError::CurrencyMismatch)
}

/// grpc-conventions §3: 16–100 caracteres.
pub fn idempotency_key(key: &str) -> Result<(), DomainError> {
    let n = key.chars().count();
    if (16..=100).contains(&n) {
        Ok(())
    } else {
        Err(DomainError::IdempotencyKeyRequired)
    }
}

/// Referencia vacía o con tipo de §9 e id no vacío (≤ 100 caracteres).
pub fn reference(kind: &str, id: &str) -> Result<(), DomainError> {
    if kind.is_empty() && id.is_empty() {
        return Ok(());
    }
    if REFERENCE_TYPES.contains(&kind) && !id.is_empty() && id.chars().count() <= 100 {
        Ok(())
    } else {
        Err(DomainError::InvalidReference)
    }
}

/// Máx. 20 claves, 500 caracteres en total, sin claves sensibles.
pub fn metadata<'a>(entries: impl Iterator<Item = (&'a str, &'a str)>) -> Result<(), DomainError> {
    let mut keys = 0usize;
    let mut chars = 0usize;
    for (k, v) in entries {
        keys = keys.saturating_add(1);
        chars = chars
            .saturating_add(k.chars().count())
            .saturating_add(v.chars().count());
        let lower = k.to_ascii_lowercase();
        if FORBIDDEN_METADATA.iter().any(|f| lower.contains(f)) {
            return Err(DomainError::InvalidMetadata);
        }
    }
    if keys > MAX_METADATA_KEYS || chars > MAX_METADATA_CHARS {
        return Err(DomainError::InvalidMetadata);
    }
    Ok(())
}

/// R4: Σ splits = monto, cada parte > 0.
pub fn splits_sum(amount_minor: i64, parts: &[i64]) -> Result<(), DomainError> {
    let mut sum: i64 = 0;
    for p in parts {
        if *p <= 0 {
            return Err(DomainError::SplitsMismatch);
        }
        sum = sum.checked_add(*p).ok_or(DomainError::Overflow)?;
    }
    if sum == amount_minor {
        Ok(())
    } else {
        Err(DomainError::SplitsMismatch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn n_std_02_decimals_come_from_iso_4217_table() {
        assert_eq!(currency_decimals("USD"), Ok(2));
        assert_eq!(currency_decimals("PAB"), Ok(2));
        assert_eq!(currency_decimals("EUR"), Err(DomainError::CurrencyMismatch));
    }

    #[test]
    fn r4_splits_must_add_up() {
        assert_eq!(splits_sum(10_000, &[6_000, 4_000]), Ok(()));
        assert_eq!(
            splits_sum(10_000, &[6_000, 3_999]),
            Err(DomainError::SplitsMismatch)
        );
        assert_eq!(
            splits_sum(10_000, &[10_000, 0]),
            Err(DomainError::SplitsMismatch)
        );
    }

    #[test]
    fn n_pag_01_metadata_rejects_card_data_keys() {
        assert_eq!(
            metadata([("order_note", "sin cebolla")].into_iter()),
            Ok(())
        );
        assert_eq!(
            metadata([("card_number", "x")].into_iter()),
            Err(DomainError::InvalidMetadata)
        );
        let many: Vec<(String, String)> =
            (0..21).map(|i| (format!("k{i}"), String::new())).collect();
        assert_eq!(
            metadata(many.iter().map(|(k, v)| (k.as_str(), v.as_str()))),
            Err(DomainError::InvalidMetadata)
        );
    }

    #[test]
    fn idempotency_keys_are_16_to_100_chars() {
        assert!(idempotency_key("0123456789abcdef").is_ok());
        assert!(idempotency_key("short").is_err());
        assert!(idempotency_key(&"x".repeat(101)).is_err());
    }

    #[test]
    fn references_use_the_shared_catalog() {
        assert!(reference("", "").is_ok());
        assert!(reference("order", "o-1").is_ok());
        assert!(reference("cart", "c-1").is_err());
        assert!(reference("order", "").is_err());
    }
}
