//! F11.10 (R10, T4): nombre abreviado de quien recibe y piernas de la transferencia.
#![allow(clippy::unwrap_used, clippy::indexing_slicing)]

use plentypay_payments_core::pb::ledger::AccountType;
use plentypay_payments_core::service::{short_name, transfer_legs};
use plentypay_payments_core::store::{FrozenFees, SplitFees};
use uuid::Uuid;

#[test]
fn r10_short_name_keeps_first_name_and_last_initial() {
    assert_eq!(short_name("Ana María Pérez Gómez"), "Ana G.");
    assert_eq!(short_name("  bárbara   rodríguez "), "bárbara R.");
    assert_eq!(short_name("Cher"), "Cher");
    assert_eq!(short_name("   "), "");
    assert_eq!(short_name("Ñandú Ávila"), "Ñandú Á.");
}

#[test]
fn r10_transfer_legs_credit_the_recipient_wallet_without_fees() {
    let to = Uuid::now_v7();
    let fees = FrozenFees {
        fee_policy_id: Uuid::nil(),
        splits: vec![SplitFees {
            merchant_party_id: to,
            gross_minor: 1250,
            platform_fee_minor: 0,
            tax_minor: 0,
            rail_fee_minor: 0,
            merchant_net_minor: 1250,
            total_charged_minor: 1250,
        }],
    };
    let (legs, total) = transfer_legs(&fees).unwrap();
    assert_eq!(total, 1250);
    assert_eq!(legs.len(), 1);
    assert_eq!(legs[0].party_id, to.to_string());
    assert_eq!(legs[0].account_type, AccountType::Wallet as i32);
    assert_eq!(legs[0].amount_minor, 1250);

    let mut with_fee = fees.clone();
    with_fee.splits[0].platform_fee_minor = 10;
    assert!(transfer_legs(&with_fee).is_err(), "una transferencia no cobra comisión");
    let mut two = fees.clone();
    two.splits.push(two.splits[0].clone());
    assert!(transfer_legs(&two).is_err(), "un solo destinatario");
}
