//! Plan de cuentas (domain-model.md §5.1). Puro: sin I/O.

use crate::domain::errors::DomainError;

/// Party de PlentyPay (domain-model.md §2).
pub const PLATFORM_PARTY: &str = "00000000-0000-0000-0000-000000000001";

/// Tipo de cuenta; los valores coinciden con `ledger.AccountType` del contrato.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum AccountType {
    Wallet = 1,
    MerchantPayable = 2,
    PlatformFees = 3,
    TaxPayable = 4,
    RailReceivable = 5,
    RailFeesPayable = 6,
    BankCash = 7,
    LoyaltyPoints = 8,
    CustomerCredit = 9,
    FundingSource = 10,
    Suspense = 11,
}

/// Clase contable: decide el lado normal del saldo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountClass {
    /// Saldo = Σ débitos − Σ créditos.
    Asset,
    /// Saldo = Σ créditos − Σ débitos (pasivos e ingresos).
    Liability,
}

/// Lado de un asiento.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Side {
    Debit,
    Credit,
}

impl Side {
    pub fn code(self) -> &'static str {
        match self {
            Side::Debit => "D",
            Side::Credit => "C",
        }
    }

    pub fn from_code(code: &str) -> Result<Self, DomainError> {
        match code {
            "D" => Ok(Side::Debit),
            "C" => Ok(Side::Credit),
            _ => Err(DomainError::InvalidSide),
        }
    }

    pub fn opposite(self) -> Self {
        match self {
            Side::Debit => Side::Credit,
            Side::Credit => Side::Debit,
        }
    }
}

impl AccountType {
    pub fn from_i32(v: i32) -> Result<Self, DomainError> {
        Ok(match v {
            1 => AccountType::Wallet,
            2 => AccountType::MerchantPayable,
            3 => AccountType::PlatformFees,
            4 => AccountType::TaxPayable,
            5 => AccountType::RailReceivable,
            6 => AccountType::RailFeesPayable,
            7 => AccountType::BankCash,
            8 => AccountType::LoyaltyPoints,
            9 => AccountType::CustomerCredit,
            10 => AccountType::FundingSource,
            11 => AccountType::Suspense,
            _ => return Err(DomainError::UnknownAccountType),
        })
    }

    pub fn code(self) -> i16 {
        self as i16
    }

    pub fn class(self) -> AccountClass {
        match self {
            AccountType::RailReceivable
            | AccountType::BankCash
            | AccountType::CustomerCredit
            | AccountType::FundingSource
            | AccountType::Suspense => AccountClass::Asset,
            AccountType::Wallet
            | AccountType::MerchantPayable
            | AccountType::PlatformFees
            | AccountType::TaxPayable
            | AccountType::RailFeesPayable
            | AccountType::LoyaltyPoints => AccountClass::Liability,
        }
    }

    /// Si la cuenta puede quedar con disponible negativo (tabla §5.1). Puntos y crédito: solo el
    /// emisor/acreedor (`party == scope`) puede ser negativo.
    pub fn allows_negative(self, party_id: &str, scope_id: &str) -> bool {
        match self {
            AccountType::PlatformFees
            | AccountType::RailReceivable
            | AccountType::FundingSource
            | AccountType::Suspense => true,
            AccountType::LoyaltyPoints | AccountType::CustomerCredit => {
                !scope_id.is_empty() && party_id == scope_id
            }
            AccountType::Wallet
            | AccountType::MerchantPayable
            | AccountType::TaxPayable
            | AccountType::RailFeesPayable
            | AccountType::BankCash => false,
        }
    }

    /// Las cuentas de plataforma solo las tiene PLATFORM.
    pub fn platform_only(self) -> bool {
        matches!(
            self,
            AccountType::PlatformFees
                | AccountType::TaxPayable
                | AccountType::RailReceivable
                | AccountType::RailFeesPayable
                | AccountType::BankCash
                | AccountType::FundingSource
                | AccountType::Suspense
        )
    }
}

/// Efecto con signo de un asiento sobre el saldo de su cuenta, según la clase.
pub fn signed_delta(
    class: AccountClass,
    side: Side,
    amount_minor: i64,
) -> Result<i64, DomainError> {
    let positive = matches!(
        (class, side),
        (AccountClass::Asset, Side::Debit) | (AccountClass::Liability, Side::Credit)
    );
    if positive {
        Ok(amount_minor)
    } else {
        amount_minor.checked_neg().ok_or(DomainError::Overflow)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn r6_wallet_never_negative_platform_fees_may() {
        assert!(!AccountType::Wallet.allows_negative("u", ""));
        assert!(AccountType::PlatformFees.allows_negative(PLATFORM_PARTY, ""));
        assert!(
            AccountType::LoyaltyPoints.allows_negative("m", "m"),
            "el emisor puede quedar negativo"
        );
        assert!(!AccountType::LoyaltyPoints.allows_negative("u", "m"));
    }

    #[test]
    fn normal_side_by_class() -> Result<(), DomainError> {
        assert_eq!(
            signed_delta(AccountType::Wallet.class(), Side::Credit, 100)?,
            100
        );
        assert_eq!(
            signed_delta(AccountType::Wallet.class(), Side::Debit, 100)?,
            -100
        );
        assert_eq!(
            signed_delta(AccountType::BankCash.class(), Side::Debit, 100)?,
            100
        );
        Ok(())
    }

    /// El chequeo de invariantes en SQL (store::check_invariants) fija los códigos de las cuentas
    /// de activo `IN (5,7,9,10,11)`; si cambia la clase de un tipo, esta prueba falla primero.
    #[test]
    fn r11_asset_codes_match_the_invariant_query() -> Result<(), DomainError> {
        let mut assets = Vec::new();
        for code in 1..=11 {
            let t = AccountType::from_i32(code)?;
            assert_eq!(i32::from(t.code()), code);
            if t.class() == AccountClass::Asset {
                assets.push(code);
            }
        }
        assert_eq!(assets, vec![5, 7, 9, 10, 11]);
        assert!(AccountType::from_i32(0).is_err());
        assert!(AccountType::from_i32(12).is_err());
        Ok(())
    }
}
