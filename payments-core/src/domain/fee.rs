#![allow(clippy::arithmetic_side_effects, clippy::indexing_slicing, clippy::too_many_arguments)]

use crate::error::PaymentsError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeBearer {
    Merchant,
    Customer,
    Platform,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FeeBreakdown {
    pub gross_minor: i64,
    pub platform_fee_minor: i64,
    pub tax_minor: i64,
    pub rail_fee_minor: i64,
    pub merchant_net_minor: i64,
    pub total_charged_minor: i64,
}

impl FeeBreakdown {
    /// half_up(v, bps) = (v * bps + 5000) / 10000 in i128.
    pub fn half_up(value_minor: i64, bps: u32) -> i64 {
        let v = value_minor as i128;
        let b = bps as i128;
        let q = (v * b + 5000) / 10000;
        q as i64
    }

    /// half_up_ratio(pf, R, g) = (2*pf*R + g) / (2*g)  (round half up).
    pub fn half_up_ratio(pf: i64, r: i64, g: i64) -> i64 {
        if g == 0 {
            return 0;
        }
        let num = 2 * (pf as i128) * (r as i128) + (g as i128);
        let den = 2 * (g as i128);
        (num / den) as i64
    }

    /// Compute fee breakdown for a charge.
    pub fn compute(
        gross_minor: i64,
        fixed_fee_minor: i64,
        percentage_bps: u32,
        tax_rate_bps: u32,
        rail_fixed_fee_minor: i64,
        rail_percentage_bps: u32,
        bearer: FeeBearer,
    ) -> Result<FeeBreakdown, PaymentsError> {
        let (platform_fee, tax, rail_fee, merchant_net, total_charged) = match bearer {
            FeeBearer::Merchant => {
                let pf = fixed_fee_minor + Self::half_up(gross_minor, percentage_bps);
                let tax = Self::half_up(pf, tax_rate_bps);
                let rf = rail_fixed_fee_minor + Self::half_up(gross_minor, rail_percentage_bps);
                let net = gross_minor - pf - tax - rf;
                if net < 0 {
                    return Err(PaymentsError::AmountBelowFees);
                }
                (pf, tax, rf, net, gross_minor)
            }
            FeeBearer::Customer => {
                let pf = fixed_fee_minor + Self::half_up(gross_minor, percentage_bps);
                let tax = Self::half_up(pf, tax_rate_bps);
                let rf = rail_fixed_fee_minor + Self::half_up(gross_minor, rail_percentage_bps);
                let total = gross_minor + pf + tax;
                let net = gross_minor - rf;
                if net < 0 {
                    return Err(PaymentsError::AmountBelowFees);
                }
                (pf, tax, rf, net, total)
            }
            FeeBearer::Platform => {
                let rf = rail_fixed_fee_minor + Self::half_up(gross_minor, rail_percentage_bps);
                let net = gross_minor - rf;
                if net < 0 {
                    return Err(PaymentsError::AmountBelowFees);
                }
                (0, 0, rf, net, gross_minor)
            }
        };
        // invariant: gross == merchant_net + platform_fee + tax + rail_fee (for merchant)
        Ok(FeeBreakdown {
            gross_minor,
            platform_fee_minor: platform_fee,
            tax_minor: tax,
            rail_fee_minor: rail_fee,
            merchant_net_minor: merchant_net,
            total_charged_minor: total_charged,
        })
    }

    /// allocate(total, weights) as in domain-model §4.3.
    pub fn allocate(total_minor: i64, weights: &[u64]) -> Result<Vec<i64>, PaymentsError> {
        if weights.is_empty() {
            return Err(PaymentsError::AmountBelowFees);
        }
        let sum_w: u128 = weights.iter().map(|w| *w as u128).sum();
        if sum_w == 0 {
            return Err(PaymentsError::AmountBelowFees);
        }
        let total_abs = total_minor.unsigned_abs() as u128;
        let negative = total_minor < 0;
        let mut floors: Vec<i64> = Vec::with_capacity(weights.len());
        let mut remainders: Vec<u128> = Vec::with_capacity(weights.len());
        let mut allocated: i128 = 0;
        for w in weights {
            let w = *w as u128;
            let prod = total_abs * w;
            let q = prod / sum_w;
            let r = prod % sum_w;
            let q_i64 = q as i64;
            floors.push(if negative { -q_i64 } else { q_i64 });
            remainders.push(r);
            allocated += q as i128;
        }
        let residue = (total_abs as i128) - allocated;
        let mut order: Vec<usize> = (0..weights.len()).collect();
        order.sort_by(|a, b| {
            if remainders[*b] != remainders[*a] {
                remainders[*b].cmp(&remainders[*a])
            } else {
                a.cmp(b)
            }
        });
        let mut result = floors.clone();
        let mut to_distribute = residue as usize;
        let mut i = 0;
        while to_distribute > 0 {
            let idx = order[i % order.len()];
            if negative {
                result[idx] -= 1;
            } else {
                result[idx] += 1;
            }
            to_distribute -= 1;
            i += 1;
        }
        Ok(result)
    }

    /// Refund ratios (R1-R3).
    pub fn refund(
        captured_gross: i64,
        captured_pf: i64,
        captured_tax: i64,
        captured_rf: i64,
        refund_amount: i64,
        rail_refundable: bool,
        is_last: bool,
        prev_pf_r: i64,
        prev_tax_r: i64,
        prev_rf_r: i64,
    ) -> (i64, i64, i64, i64) {
        // returns (pf_r, tax_r, rf_r, merchant_debit)
        let (pf_r, tax_r, rf_r) = if is_last {
            (captured_pf - prev_pf_r, captured_tax - prev_tax_r, if rail_refundable { captured_rf - prev_rf_r } else { 0 })
        } else {
            let pf_r = Self::half_up_ratio(captured_pf, refund_amount, captured_gross);
            let tax_r = Self::half_up_ratio(captured_tax, refund_amount, captured_gross);
            let rf_r = if rail_refundable {
                Self::half_up_ratio(captured_rf, refund_amount, captured_gross)
            } else {
                0
            };
            (pf_r, tax_r, rf_r)
        };
        let merchant_debit = refund_amount - pf_r - tax_r - rf_r;
        (pf_r, tax_r, rf_r, merchant_debit)
    }
}
