//! Motor de comisiones (domain-model.md §4). Enteros en 128 bits, nunca flotantes (ADR 0013). Los
//! vectores A–E y R1–R3 de §4.5 son pruebas literales (`tests/fees_vectors.rs`).

use crate::domain::errors::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeBearer {
    Merchant,
    Customer,
    Platform,
}

impl FeeBearer {
    pub fn code(self) -> i16 {
        match self {
            FeeBearer::Merchant => 1,
            FeeBearer::Customer => 2,
            FeeBearer::Platform => 3,
        }
    }

    pub fn from_code(code: i16) -> Option<Self> {
        match code {
            1 => Some(FeeBearer::Merchant),
            2 => Some(FeeBearer::Customer),
            3 => Some(FeeBearer::Platform),
            _ => None,
        }
    }
}

/// Lo que importa de una `FeePolicy` para calcular (columnas de `payments.fee_policies`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FeeTerms {
    pub fixed_fee_minor: i64,
    pub percentage_bps: u32,
    pub tax_rate_bps: u32,
    pub rail_fixed_fee_minor: i64,
    pub rail_percentage_bps: u32,
    pub bearer: FeeBearer,
}

impl FeeTerms {
    /// Una política válida: montos ≥ 0 y porcentajes en 0..=10000 bps.
    pub fn validate(&self) -> Result<(), DomainError> {
        let bps_ok = |b: u32| b <= 10_000;
        if self.fixed_fee_minor < 0
            || self.rail_fixed_fee_minor < 0
            || !bps_ok(self.percentage_bps)
            || !bps_ok(self.tax_rate_bps)
            || !bps_ok(self.rail_percentage_bps)
        {
            return Err(DomainError::InvalidFeePolicy);
        }
        Ok(())
    }

    /// La wallet es interna: no hay comisión de riel (la plantilla T3 no tiene línea RAIL).
    pub fn without_rail_fee(self) -> Self {
        FeeTerms {
            rail_fixed_fee_minor: 0,
            rail_percentage_bps: 0,
            ..self
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FeeBreakdown {
    /// Base del cobro (lo que corresponde al comercio antes de comisiones).
    pub gross_minor: i64,
    pub platform_fee_minor: i64,
    pub tax_minor: i64,
    pub rail_fee_minor: i64,
    pub merchant_net_minor: i64,
    /// Lo que paga el pagador: `gross` salvo con portador CUSTOMER (`gross + pf + tax`).
    pub total_charged_minor: i64,
}

fn to_i64(v: i128) -> Result<i64, DomainError> {
    i64::try_from(v).map_err(|_| DomainError::Overflow)
}

/// `half_up(v, bps) = (v * bps + 5000) / 10000` (§4.2), v ≥ 0.
pub fn half_up(value_minor: i64, bps: u32) -> Result<i64, DomainError> {
    let v = i128::from(value_minor);
    let n = v
        .checked_mul(i128::from(bps))
        .and_then(|x| x.checked_add(5000))
        .ok_or(DomainError::Overflow)?;
    to_i64(n.div_euclid(10_000))
}

/// `half_up_ratio(pf, R, g) = (2*pf*R + g) / (2*g)` (§4.4).
pub fn half_up_ratio(part: i64, r: i64, g: i64) -> Result<i64, DomainError> {
    if g <= 0 {
        return Err(DomainError::AmountOutOfRange);
    }
    let (p, r, g) = (i128::from(part), i128::from(r), i128::from(g));
    let num = p
        .checked_mul(r)
        .and_then(|x| x.checked_mul(2))
        .and_then(|x| x.checked_add(g))
        .ok_or(DomainError::Overflow)?;
    let den = g.checked_mul(2).ok_or(DomainError::Overflow)?;
    to_i64(num.div_euclid(den))
}

fn add(a: i64, b: i64) -> Result<i64, DomainError> {
    a.checked_add(b).ok_or(DomainError::Overflow)
}

fn sub(a: i64, b: i64) -> Result<i64, DomainError> {
    a.checked_sub(b).ok_or(DomainError::Overflow)
}

impl FeeBreakdown {
    /// §4.2 por portador. `merchant_net < 0` → `AMOUNT_BELOW_FEES`.
    pub fn compute(gross_minor: i64, t: &FeeTerms) -> Result<FeeBreakdown, DomainError> {
        if gross_minor <= 0 {
            return Err(DomainError::AmountOutOfRange);
        }
        let rf = add(
            t.rail_fixed_fee_minor,
            half_up(gross_minor, t.rail_percentage_bps)?,
        )?;
        let (pf, tax) = match t.bearer {
            FeeBearer::Platform => (0, 0),
            FeeBearer::Merchant | FeeBearer::Customer => {
                let pf = add(t.fixed_fee_minor, half_up(gross_minor, t.percentage_bps)?)?;
                (pf, half_up(pf, t.tax_rate_bps)?)
            }
        };
        let (net, total) = match t.bearer {
            FeeBearer::Merchant => (sub(sub(sub(gross_minor, pf)?, tax)?, rf)?, gross_minor),
            FeeBearer::Customer => (sub(gross_minor, rf)?, add(add(gross_minor, pf)?, tax)?),
            FeeBearer::Platform => (sub(gross_minor, rf)?, gross_minor),
        };
        if net < 0 {
            return Err(DomainError::AmountBelowFees);
        }
        Ok(FeeBreakdown {
            gross_minor,
            platform_fee_minor: pf,
            tax_minor: tax,
            rail_fee_minor: rf,
            merchant_net_minor: net,
            total_charged_minor: total,
        })
    }

    /// Suma de varios desgloses (un intent con splits: §4.3 aplica la fórmula por split).
    pub fn sum(parts: &[FeeBreakdown]) -> Result<FeeBreakdown, DomainError> {
        let mut acc = FeeBreakdown {
            gross_minor: 0,
            platform_fee_minor: 0,
            tax_minor: 0,
            rail_fee_minor: 0,
            merchant_net_minor: 0,
            total_charged_minor: 0,
        };
        for p in parts {
            acc = FeeBreakdown {
                gross_minor: add(acc.gross_minor, p.gross_minor)?,
                platform_fee_minor: add(acc.platform_fee_minor, p.platform_fee_minor)?,
                tax_minor: add(acc.tax_minor, p.tax_minor)?,
                rail_fee_minor: add(acc.rail_fee_minor, p.rail_fee_minor)?,
                merchant_net_minor: add(acc.merchant_net_minor, p.merchant_net_minor)?,
                total_charged_minor: add(acc.total_charged_minor, p.total_charged_minor)?,
            };
        }
        Ok(acc)
    }
}

/// Reverso de comisiones de un reembolso (§4.4). `previous` = (pf_r, tax_r, rf_r) ya devueltos.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RefundSplit {
    pub pf_r: i64,
    pub tax_r: i64,
    pub rf_r: i64,
    pub merchant_debit: i64,
}

pub fn refund_split(
    captured: &FeeBreakdown,
    refund_minor: i64,
    already_refunded_minor: i64,
    previous: (i64, i64, i64),
    rail_fee_refundable: bool,
) -> Result<RefundSplit, DomainError> {
    let g = captured.gross_minor;
    if refund_minor <= 0 {
        return Err(DomainError::AmountOutOfRange);
    }
    let after = add(already_refunded_minor, refund_minor)?;
    if after > g {
        return Err(DomainError::RefundExceedsCaptured);
    }
    let (pf_r, tax_r, rf_r) = if after == g {
        // El último reembolso usa el remanente exacto: nunca se devuelve más comisión de la cobrada.
        (
            sub(captured.platform_fee_minor, previous.0)?,
            sub(captured.tax_minor, previous.1)?,
            if rail_fee_refundable {
                sub(captured.rail_fee_minor, previous.2)?
            } else {
                0
            },
        )
    } else {
        (
            half_up_ratio(captured.platform_fee_minor, refund_minor, g)?,
            half_up_ratio(captured.tax_minor, refund_minor, g)?,
            if rail_fee_refundable {
                half_up_ratio(captured.rail_fee_minor, refund_minor, g)?
            } else {
                0
            },
        )
    };
    Ok(RefundSplit {
        pf_r,
        tax_r,
        rf_r,
        merchant_debit: sub(sub(sub(refund_minor, pf_r)?, tax_r)?, rf_r)?,
    })
}

/// `allocate(total, weights)` (§4.3): piso de cada parte y el residuo, de a 1 centavo, a las de
/// mayor resto fraccional (desempate por orden de entrada).
pub fn allocate(total_minor: i64, weights: &[u64]) -> Result<Vec<i64>, DomainError> {
    if total_minor < 0 {
        return Err(DomainError::AmountOutOfRange);
    }
    let sum_w: u128 = weights.iter().map(|w| u128::from(*w)).sum();
    if sum_w == 0 {
        return Err(DomainError::AmountOutOfRange);
    }
    let total = u128::from(total_minor.unsigned_abs());
    let mut parts: Vec<(usize, i64, u128)> = Vec::with_capacity(weights.len());
    let mut assigned: u128 = 0;
    for (i, w) in weights.iter().enumerate() {
        let prod = total
            .checked_mul(u128::from(*w))
            .ok_or(DomainError::Overflow)?;
        let floor = prod.checked_div(sum_w).ok_or(DomainError::Overflow)?;
        let rem = prod.checked_rem(sum_w).ok_or(DomainError::Overflow)?;
        assigned = assigned.checked_add(floor).ok_or(DomainError::Overflow)?;
        parts.push((
            i,
            i64::try_from(floor).map_err(|_| DomainError::Overflow)?,
            rem,
        ));
    }
    let mut residue = total.checked_sub(assigned).ok_or(DomainError::Overflow)?;
    let mut order: Vec<usize> = (0..parts.len()).collect();
    order.sort_by(|a, b| {
        let ra = parts.get(*a).map(|p| p.2).unwrap_or(0);
        let rb = parts.get(*b).map(|p| p.2).unwrap_or(0);
        rb.cmp(&ra).then(a.cmp(b))
    });
    for idx in order {
        if residue == 0 {
            break;
        }
        if let Some(p) = parts.get_mut(idx) {
            p.1 = add(p.1, 1)?;
            residue = residue.saturating_sub(1);
        }
    }
    Ok(parts.into_iter().map(|p| p.1).collect())
}
