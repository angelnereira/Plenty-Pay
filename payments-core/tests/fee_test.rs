#![allow(clippy::unwrap_used, clippy::expect_used)]

use plentypay_payments_core::domain::fee::{FeeBearer, FeeBreakdown};

#[test]
fn vector_a() {
    let fb = FeeBreakdown::compute(10000, 0, 250, 700, 0, 100, FeeBearer::Merchant).unwrap();
    assert_eq!(fb.platform_fee_minor, 250);
    assert_eq!(fb.tax_minor, 18);
    assert_eq!(fb.rail_fee_minor, 100);
    assert_eq!(fb.merchant_net_minor, 9632);
}

#[test]
fn vector_b() {
    let fb = FeeBreakdown::compute(1234, 0, 250, 700, 0, 0, FeeBearer::Merchant).unwrap();
    assert_eq!(fb.platform_fee_minor, 31);
    assert_eq!(fb.tax_minor, 2);
    assert_eq!(fb.merchant_net_minor, 1201);
}

#[test]
fn vector_c() {
    let fb = FeeBreakdown::compute(25, 10, 290, 700, 0, 0, FeeBearer::Merchant).unwrap();
    assert_eq!(fb.platform_fee_minor, 11);
    assert_eq!(fb.tax_minor, 1);
    assert_eq!(fb.merchant_net_minor, 13);
}

#[test]
fn vector_c_err() {
    let r = FeeBreakdown::compute(10, 10, 290, 700, 0, 0, FeeBearer::Merchant);
    assert!(r.is_err());
}

#[test]
fn vector_d() {
    let fb = FeeBreakdown::compute(5000, 10, 250, 700, 0, 0, FeeBearer::Customer).unwrap();
    assert_eq!(fb.platform_fee_minor, 135);
    assert_eq!(fb.tax_minor, 9);
    assert_eq!(fb.total_charged_minor, 5144);
    assert_eq!(fb.merchant_net_minor, 5000);
}

#[test]
fn vector_e() {
    // intent 10000 with splits 6000 and 4000
    let a = FeeBreakdown::compute(6000, 0, 250, 700, 0, 100, FeeBearer::Merchant).unwrap();
    let b = FeeBreakdown::compute(4000, 0, 250, 700, 0, 100, FeeBearer::Merchant).unwrap();
    assert_eq!(a.platform_fee_minor, 150);
    assert_eq!(a.tax_minor, 11);
    assert_eq!(a.rail_fee_minor, 60);
    assert_eq!(a.merchant_net_minor, 5779);
    assert_eq!(b.platform_fee_minor, 100);
    assert_eq!(b.tax_minor, 7);
    assert_eq!(b.rail_fee_minor, 40);
    assert_eq!(b.merchant_net_minor, 3853);
}

#[test]
fn vector_r1() {
    // refund 2500 of A, rail not refundable
    let (pf_r, tax_r, rf_r, md) = FeeBreakdown::refund(10000, 250, 18, 100, 2500, false, false, 0, 0, 0);
    assert_eq!(pf_r, 63);
    assert_eq!(tax_r, 5);
    assert_eq!(rf_r, 0);
    assert_eq!(md, 2432);
}

#[test]
fn vector_r2() {
    let (pf_r, tax_r, rf_r, md) = FeeBreakdown::refund(10000, 250, 18, 100, 2500, true, false, 0, 0, 0);
    assert_eq!(pf_r, 63);
    assert_eq!(tax_r, 5);
    assert_eq!(rf_r, 25);
    assert_eq!(md, 2407);
}

#[test]
fn vector_r3() {
    // total refund 10000, rail not refundable
    let (pf_r, tax_r, rf_r, md) = FeeBreakdown::refund(10000, 250, 18, 100, 10000, false, true, 0, 0, 0);
    assert_eq!(pf_r, 250);
    assert_eq!(tax_r, 18);
    assert_eq!(rf_r, 0);
    assert_eq!(md, 9732);
}

#[test]
fn allocate_splits() {
    let parts = FeeBreakdown::allocate(10000, &[6000, 4000]).unwrap();
    assert_eq!(parts, vec![6000, 4000]);
}
