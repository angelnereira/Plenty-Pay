#![allow(clippy::unwrap_used, clippy::expect_used)]

use plentypay_ledger::domain::money::{Currency, Money};
use proptest::prelude::*;

#[test]
fn vector_a() {
    // gross 10000, fixed 0, pct 250 bps, tax 700 bps, rail 100 bps
    let gross: i64 = 10000;
    let pf = Money::half_up_raw(gross, 250).unwrap();
    let tax = Money::half_up_raw(pf, 700).unwrap();
    let rail = Money::half_up_raw(gross, 100).unwrap();
    let net = gross - pf - tax - rail;
    assert_eq!(pf, 250);
    assert_eq!(tax, 18);
    assert_eq!(rail, 100);
    assert_eq!(net, 9632);
}

#[test]
fn vector_b() {
    let gross: i64 = 1234;
    let pf = Money::half_up_raw(gross, 250).unwrap();
    let tax = Money::half_up_raw(pf, 700).unwrap();
    let rail: i64 = 0;
    let net = gross - pf - tax - rail;
    assert_eq!(pf, 31);
    assert_eq!(tax, 2);
    assert_eq!(net, 1201);
}

#[test]
fn vector_c() {
    let gross: i64 = 25;
    let fixed: i64 = 10;
    let pf = fixed + Money::half_up_raw(gross, 290).unwrap();
    let tax = Money::half_up_raw(pf, 700).unwrap();
    let net = gross - pf - tax;
    assert_eq!(pf, 11);
    assert_eq!(tax, 1);
    assert_eq!(net, 13);
}

#[test]
fn vector_c_err() {
    let gross: i64 = 10;
    let fixed: i64 = 10;
    let pf = fixed + Money::half_up_raw(gross, 290).unwrap();
    let tax = Money::half_up_raw(pf, 700).unwrap();
    let net = gross - pf - tax;
    assert_eq!(net, -1);
}

#[test]
fn vector_d() {
    let base: i64 = 5000;
    let fixed: i64 = 10;
    let pf = fixed + Money::half_up_raw(base, 250).unwrap();
    let tax = Money::half_up_raw(pf, 700).unwrap();
    let total_charged = base + pf + tax;
    let merchant_net = base;
    assert_eq!(pf, 135);
    assert_eq!(tax, 9);
    assert_eq!(total_charged, 5144);
    assert_eq!(merchant_net, 5000);
}

#[test]
fn checked_add_currency_mismatch() {
    let a = Money::new(100, Currency::USD).unwrap();
    let b = Money::new(100, Currency::PAN).unwrap();
    assert!(a.checked_add(b).is_err());
}

#[test]
fn checked_add_overflow() {
    let a = Money::new(i64::MAX, Currency::USD).unwrap();
    let b = Money::new(1, Currency::USD).unwrap();
    assert!(a.checked_add(b).is_err());
}

proptest! {
    #[test]
    fn allocate_sums_to_total(total in -1000i64..1000i64, n in 1usize..6usize) {
        let weights: Vec<u64> = (0..n).map(|i| (i as u64) + 1).collect();
        let m = Money::new(total, Currency::USD).unwrap();
        let parts = Money::allocate(m, &weights).unwrap();
        let sum: i64 = parts.iter().map(|p| p.amount_minor()).sum();
        prop_assert_eq!(sum, total);
    }
}
