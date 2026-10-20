//! Vectores obligatorios de domain-model.md §4.5 (literales). R3 del SPEC.
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::arithmetic_side_effects
)]

use plentypay_payments_core::domain::errors::DomainError;
use plentypay_payments_core::domain::fees::{
    allocate, refund_split, FeeBearer, FeeBreakdown, FeeTerms,
};

fn terms(fixed: i64, pct: u32, tax: u32, rail_pct: u32, bearer: FeeBearer) -> FeeTerms {
    FeeTerms {
        fixed_fee_minor: fixed,
        percentage_bps: pct,
        tax_rate_bps: tax,
        rail_fixed_fee_minor: 0,
        rail_percentage_bps: rail_pct,
        bearer,
    }
}

fn a() -> FeeBreakdown {
    FeeBreakdown::compute(10_000, &terms(0, 250, 700, 100, FeeBearer::Merchant)).unwrap()
}

#[test]
fn r3_vector_a() {
    let b = a();
    assert_eq!(
        (
            b.platform_fee_minor,
            b.tax_minor,
            b.rail_fee_minor,
            b.merchant_net_minor
        ),
        (250, 18, 100, 9_632)
    );
    // Invariante del FeeBreakdown: gross == merchant_net + Σ líneas.
    assert_eq!(
        b.gross_minor,
        b.merchant_net_minor + b.platform_fee_minor + b.tax_minor + b.rail_fee_minor
    );
}

#[test]
fn r3_vector_b_half_up() {
    let b = FeeBreakdown::compute(1_234, &terms(0, 250, 700, 0, FeeBearer::Merchant)).unwrap();
    assert_eq!(
        (b.platform_fee_minor, b.tax_minor, b.merchant_net_minor),
        (31, 2, 1_201)
    );
}

#[test]
fn r3_vector_c() {
    let b = FeeBreakdown::compute(25, &terms(10, 290, 700, 0, FeeBearer::Merchant)).unwrap();
    assert_eq!(
        (b.platform_fee_minor, b.tax_minor, b.merchant_net_minor),
        (11, 1, 13)
    );
}

#[test]
fn r3_vector_c_err_amount_below_fees() {
    assert_eq!(
        FeeBreakdown::compute(10, &terms(10, 290, 700, 0, FeeBearer::Merchant)),
        Err(DomainError::AmountBelowFees)
    );
}

#[test]
fn r3_vector_d_customer_bearer() {
    let b = FeeBreakdown::compute(5_000, &terms(10, 250, 700, 0, FeeBearer::Customer)).unwrap();
    assert_eq!((b.platform_fee_minor, b.tax_minor), (135, 9));
    assert_eq!(
        (b.total_charged_minor, b.merchant_net_minor),
        (5_144, 5_000)
    );
}

#[test]
fn r3_vector_e_per_split() {
    let t = terms(0, 250, 700, 100, FeeBearer::Merchant);
    let x = FeeBreakdown::compute(6_000, &t).unwrap();
    let y = FeeBreakdown::compute(4_000, &t).unwrap();
    assert_eq!(
        (
            x.platform_fee_minor,
            x.tax_minor,
            x.rail_fee_minor,
            x.merchant_net_minor
        ),
        (150, 11, 60, 5_779)
    );
    assert_eq!(
        (
            y.platform_fee_minor,
            y.tax_minor,
            y.rail_fee_minor,
            y.merchant_net_minor
        ),
        (100, 7, 40, 3_853)
    );
    let total = FeeBreakdown::sum(&[x, y]).unwrap();
    assert_eq!(total.gross_minor, 10_000);
}

#[test]
fn r3_platform_bearer_charges_no_platform_fee() {
    let b = FeeBreakdown::compute(10_000, &terms(0, 250, 700, 100, FeeBearer::Platform)).unwrap();
    assert_eq!(
        (
            b.platform_fee_minor,
            b.tax_minor,
            b.rail_fee_minor,
            b.merchant_net_minor
        ),
        (0, 0, 100, 9_900)
    );
}

#[test]
fn r3_wallet_has_no_rail_fee() {
    let t = terms(0, 250, 700, 100, FeeBearer::Merchant).without_rail_fee();
    let b = FeeBreakdown::compute(10_000, &t).unwrap();
    assert_eq!((b.rail_fee_minor, b.merchant_net_minor), (0, 9_732));
}

#[test]
fn r11_vector_r1_partial_refund_rail_not_refundable() {
    let r = refund_split(&a(), 2_500, 0, (0, 0, 0), false).unwrap();
    assert_eq!(
        (r.pf_r, r.tax_r, r.rf_r, r.merchant_debit),
        (63, 5, 0, 2_432)
    );
}

#[test]
fn r11_vector_r2_partial_refund_rail_refundable() {
    let r = refund_split(&a(), 2_500, 0, (0, 0, 0), true).unwrap();
    assert_eq!(
        (r.pf_r, r.tax_r, r.rf_r, r.merchant_debit),
        (63, 5, 25, 2_407)
    );
}

#[test]
fn r11_vector_r3_full_refund() {
    let r = refund_split(&a(), 10_000, 0, (0, 0, 0), false).unwrap();
    assert_eq!(
        (r.pf_r, r.tax_r, r.rf_r, r.merchant_debit),
        (250, 18, 0, 9_732)
    );
}

#[test]
fn r11_last_refund_uses_the_exact_remainder() {
    let first = refund_split(&a(), 3_333, 0, (0, 0, 0), false).unwrap();
    let last = refund_split(
        &a(),
        6_667,
        3_333,
        (first.pf_r, first.tax_r, first.rf_r),
        false,
    )
    .unwrap();
    assert_eq!(first.pf_r + last.pf_r, 250);
    assert_eq!(first.tax_r + last.tax_r, 18);
    assert_eq!(
        refund_split(&a(), 1, 10_000, (250, 18, 0), false),
        Err(DomainError::RefundExceedsCaptured)
    );
}

#[test]
fn allocate_gives_residue_to_largest_remainders() {
    assert_eq!(
        allocate(10_000, &[6_000, 4_000]).unwrap(),
        vec![6_000, 4_000]
    );
    assert_eq!(allocate(100, &[1, 1, 1]).unwrap(), vec![34, 33, 33]);
    assert_eq!(allocate(101, &[1, 2]).unwrap().iter().sum::<i64>(), 101);
}

mod properties {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        /// §4.2: con cualquier política válida, el residuo queda en merchant_net y la suma cuadra.
        #[test]
        fn r3_breakdown_always_balances(gross in 1i64..=1_000_000_000, fixed in 0i64..=1_000, pct in 0u32..=10_000, tax in 0u32..=10_000, rail in 0u32..=1_000) {
            let t = terms(fixed, pct, tax, rail, FeeBearer::Merchant);
            if let Ok(b) = FeeBreakdown::compute(gross, &t) {
                prop_assert!(b.merchant_net_minor >= 0);
                prop_assert_eq!(b.gross_minor, b.merchant_net_minor + b.platform_fee_minor + b.tax_minor + b.rail_fee_minor);
            }
        }

        #[test]
        fn allocate_preserves_the_total(total in 0i64..=1_000_000_000, weights in proptest::collection::vec(1u64..=1_000, 1..10)) {
            prop_assert_eq!(allocate(total, &weights).unwrap().iter().sum::<i64>(), total);
        }
    }
}
