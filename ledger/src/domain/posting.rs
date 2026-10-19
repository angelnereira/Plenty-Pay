#![allow(clippy::arithmetic_side_effects, clippy::indexing_slicing)]
/// Posting templates (domain-model.md §5.2). The template id is stored in the transaction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateId {
    T1Topup,
    T2CardCapture,
    T3WalletPayment,
    T4P2P,
    T5RailSettle,
    T6PayoutBank,
    T6bPayoutWallet,
    T7Refund,
    T8Loyalty,
    T9CreditSale,
    T9bCreditPayment,
}

impl TemplateId {
    pub fn as_str(&self) -> &'static str {
        match self {
            TemplateId::T1Topup => "T1",
            TemplateId::T2CardCapture => "T2",
            TemplateId::T3WalletPayment => "T3",
            TemplateId::T4P2P => "T4",
            TemplateId::T5RailSettle => "T5",
            TemplateId::T6PayoutBank => "T6",
            TemplateId::T6bPayoutWallet => "T6b",
            TemplateId::T7Refund => "T7",
            TemplateId::T8Loyalty => "T8",
            TemplateId::T9CreditSale => "T9",
            TemplateId::T9bCreditPayment => "T9b",
        }
    }
}

/// A single entry in a posting template.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Entry {
    pub side: Side,
    pub account_type: &'static str,
    pub amount_minor: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Debit,
    Credit,
}

/// A balanced posting template instance: list of entries. Sum of debits == sum of credits.
#[derive(Debug, Clone)]
pub struct PostingTemplate {
    pub id: TemplateId,
    pub entries: Vec<Entry>,
}

impl PostingTemplate {
    pub fn is_balanced(&self) -> bool {
        let mut d: i128 = 0;
        let mut c: i128 = 0;
        for e in &self.entries {
            if e.amount_minor <= 0 {
                return false;
            }
            match e.side {
                Side::Debit => d += e.amount_minor as i128,
                Side::Credit => c += e.amount_minor as i128,
            }
        }
        d == c && !self.entries.is_empty() && self.entries.len() >= 2
    }
}
