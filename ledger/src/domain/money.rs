#![allow(clippy::arithmetic_side_effects, clippy::indexing_slicing)]
use crate::error::LedgerError;

/// Currency as ISO 4217 code (3 letters) or "PTS" for loyalty points.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Currency(pub [u8; 3]);

impl Currency {
    pub const USD: Currency = Currency(*b"USD");
    pub const PAN: Currency = Currency(*b"PAB");

    pub fn from_code(code: &str) -> Result<Self, LedgerError> {
        if code.len() != 3 {
            return Err(LedgerError::InvalidAmount);
        }
        let bytes = code.as_bytes();
        let mut arr = [0u8; 3];
        arr.copy_from_slice(bytes);
        Ok(Currency(arr))
    }

    pub fn code(&self) -> &str {
        std::str::from_utf8(&self.0).unwrap_or("???")
    }
}

/// Money in minor units (cents). Never float.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Money {
    amount_minor: i64,
    currency: Currency,
}

impl Money {
    pub fn new(amount_minor: i64, currency: Currency) -> Result<Self, LedgerError> {
        if amount_minor < 0 {
            // Money can represent negatives internally (debits), but construction via new allows signed.
        }
        Ok(Money { amount_minor, currency })
    }

    pub fn zero(currency: Currency) -> Self {
        Money { amount_minor: 0, currency }
    }

    pub fn amount_minor(&self) -> i64 {
        self.amount_minor
    }

    pub fn currency(&self) -> Currency {
        self.currency
    }

    pub fn checked_add(self, other: Money) -> Result<Money, LedgerError> {
        if self.currency != other.currency {
            return Err(LedgerError::CurrencyMismatch(self.currency.code().to_string(), other.currency.code().to_string()));
        }
        let sum = (self.amount_minor as i128) + (other.amount_minor as i128);
        let v = i64::try_from(sum).map_err(|_| LedgerError::Overflow)?;
        Ok(Money { amount_minor: v, currency: self.currency })
    }

    pub fn checked_sub(self, other: Money) -> Result<Money, LedgerError> {
        if self.currency != other.currency {
            return Err(LedgerError::CurrencyMismatch(self.currency.code().to_string(), other.currency.code().to_string()));
        }
        let diff = (self.amount_minor as i128) - (other.amount_minor as i128);
        let v = i64::try_from(diff).map_err(|_| LedgerError::Overflow)?;
        Ok(Money { amount_minor: v, currency: self.currency })
    }

    /// Compute half_up on a raw i64 value, returning i64.
    pub fn half_up_raw(value_minor: i64, bps: u32) -> Result<i64, LedgerError> {
        let v = value_minor as i128;
        let b = bps as i128;
        let num = v * b + 5000;
        let den = 10000i128;
        let q = num / den;
        i64::try_from(q).map_err(|_| LedgerError::Overflow)
    }

    /// percent_bps_half_up as Money in the given currency.
    pub fn percent_bps_half_up_money(value: Money, bps: u32) -> Result<Money, LedgerError> {
        let q = Self::half_up_raw(value.amount_minor, bps)?;
        Ok(Money { amount_minor: q, currency: value.currency })
    }

    /// allocate(total, weights): each part = floor(total * w_i / sum_w); residue distributed
    /// one centavo at a time to parts with largest fractional remainder, tie-break by input order.
    pub fn allocate(total: Money, weights: &[u64]) -> Result<Vec<Money>, LedgerError> {
        if weights.is_empty() {
            return Err(LedgerError::EmptyWeights);
        }
        let sum_w: u128 = weights.iter().map(|w| *w as u128).sum();
        if sum_w == 0 {
            return Err(LedgerError::DivisionByZero);
        }
        let total_minor = total.amount_minor;
        let total_abs = total_minor.unsigned_abs() as u128;
        let negative = total_minor < 0;

        // floor division for each
        let mut floors: Vec<i64> = Vec::with_capacity(weights.len());
        let mut remainders: Vec<u128> = Vec::with_capacity(weights.len());
        let mut allocated: i128 = 0;
        for w in weights {
            let w = *w as u128;
            // total * w / sum_w
            let prod = total_abs * w;
            let q = prod / sum_w; // floor
            let r = prod % sum_w;
            let q_i64 = i64::try_from(q).map_err(|_| LedgerError::Overflow)?;
            floors.push(if negative { -q_i64 } else { q_i64 });
            remainders.push(r);
            allocated += q as i128;
        }
        // residue in minor units (absolute)
        let residue = (total_abs as i128) - allocated;
        // distribute residue (positive) to largest remainders, tie-break by order
        // build order by remainder desc, then index asc
        let mut order: Vec<usize> = (0..weights.len()).collect();
        order.sort_by(|a, b| {
            // descending remainder
            if remainders[*b] != remainders[*a] {
                remainders[*b].cmp(&remainders[*a])
            } else {
                a.cmp(b)
            }
        });
        let mut result_minor: Vec<i64> = floors.clone();
        let mut to_distribute = residue as usize;
        // distribute at most residue cents
        let mut i = 0;
        while to_distribute > 0 {
            let idx = order[i % order.len()];
            if negative {
                result_minor[idx] -= 1;
            } else {
                result_minor[idx] += 1;
            }
            to_distribute -= 1;
            i += 1;
        }
        let mut out = Vec::with_capacity(weights.len());
        for m in result_minor {
            out.push(Money { amount_minor: m, currency: total.currency });
        }
        Ok(out)
    }
}
