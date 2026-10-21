//! Reglas puras de la liquidación (SPEC §5): sin E/S ni reloj propio. Todo monto es un entero en
//! unidades menores y toda suma se comprueba (ADR 0013).

use chrono::{DateTime, Datelike, Duration, NaiveTime, TimeZone, Utc};
use uuid::Uuid;

/// Errores de dominio con `reason` estable (glosario §7.3); la traducción a gRPC vive en
/// `grpc/errors.rs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum DomainError {
    #[error("nothing to settle")]
    NothingToSettle,
    #[error("below minimum payout")]
    BelowMinimum,
    #[error("only test funds to settle, payable to the wallet only")]
    SandboxFunds,
    #[error("payouts blocked after a destination change")]
    PayoutsBlocked,
    #[error("invalid destination")]
    InvalidDestination,
    /// La cuenta bancaria de PlentyPay aún no registra los depósitos del riel (falta T5).
    #[error("bank funds pending reconciliation")]
    BankFundsPending,
    #[error("invalid argument")]
    InvalidArgument,
    #[error("invalid state transition")]
    InvalidStateTransition,
    #[error("idempotency key required")]
    IdempotencyKeyRequired,
    #[error("arithmetic overflow")]
    Overflow,
}

/// Estado de un lote (domain-model §8.6; mismos números que `BatchStatus`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BatchStatus {
    Open = 1,
    Processing = 2,
    Paid = 3,
    Failed = 4,
}

impl BatchStatus {
    pub fn code(self) -> i16 {
        self as i16
    }

    pub fn from_code(c: i16) -> Option<Self> {
        match c {
            1 => Some(Self::Open),
            2 => Some(Self::Processing),
            3 => Some(Self::Paid),
            4 => Some(Self::Failed),
            _ => None,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Open => "OPEN",
            Self::Processing => "PROCESSING",
            Self::Paid => "PAID",
            Self::Failed => "FAILED",
        }
    }
}

/// Frecuencia del calendario (mismos números que `PayoutFrequency`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Frequency {
    Daily = 1,
    Weekly = 2,
    Manual = 3,
}

impl Frequency {
    pub fn from_code(c: i32) -> Option<Self> {
        match c {
            1 => Some(Self::Daily),
            2 => Some(Self::Weekly),
            3 => Some(Self::Manual),
            _ => None,
        }
    }
}

pub const DEST_BANK: &str = "BANK";
pub const DEST_WALLET: &str = "WALLET";

/// Cambio de destino: los pagos quedan bloqueados 48 h (R5, antifraude).
pub fn destination_lock() -> Duration {
    Duration::hours(48)
}

/// Clase de una partida.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ItemKind {
    Payment,
    Refund,
}

impl ItemKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::Payment => "PAYMENT",
            Self::Refund => "REFUND",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "PAYMENT" => Some(Self::Payment),
            "REFUND" => Some(Self::Refund),
            _ => None,
        }
    }
}

/// Un movimiento de `MERCHANT_PAYABLE` candidato a liquidarse: un cobro acreditado al comercio o un
/// reembolso descontado, con el asiento del ledger que lo originó.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Line {
    pub ledger_transaction_id: Uuid,
    pub kind: ItemKind,
    pub reference_type: String,
    pub reference_id: String,
    pub amount_minor: i64,
    pub occurred_at: DateTime<Utc>,
    /// Cobrado por un riel sin credenciales (R13 de payments-core): no es dinero real.
    pub sandbox: bool,
}

/// Lo que entra en un lote.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Selection {
    pub items: Vec<Line>,
    pub gross_minor: i64,
    pub refunds_minor: i64,
    pub net_minor: i64,
    pub sandbox: bool,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
}

/// Elige las partidas de un lote (R1, R2, R3, R6).
///
/// - `lines` llegan en orden cronológico y ya sin las partidas liquidadas antes (R1).
/// - Con destino bancario (`allow_sandbox = false`) los cobros de prueba no entran (R2); con la
///   billetera sí, y el lote queda marcado como de prueba.
/// - Todos los reembolsos elegibles entran y se descuentan primero: el disponible del ledger ya los
///   restó. Los cobros entran en orden mientras el neto no supere lo disponible en
///   `MERCHANT_PAYABLE` (R3); el primero que no cabe y los siguientes esperan al próximo lote, para
///   no saltarse el orden.
/// - Un neto ≤ 0 es `NothingToSettle`; uno menor que el mínimo, `BelowMinimum` (R6). Si solo hay
///   cobros de prueba y el destino es el banco, `SandboxFunds`.
pub fn select(
    lines: &[Line],
    available_minor: i64,
    allow_sandbox: bool,
    minimum_minor: i64,
) -> Result<Selection, DomainError> {
    let mut skipped_sandbox = false;
    let mut refunds: i64 = 0;
    for l in lines {
        if l.amount_minor <= 0 {
            return Err(DomainError::InvalidArgument);
        }
        if l.sandbox && !allow_sandbox {
            skipped_sandbox = true;
        } else if l.kind == ItemKind::Refund {
            refunds = refunds
                .checked_add(l.amount_minor)
                .ok_or(DomainError::Overflow)?;
        }
    }
    let mut items = Vec::new();
    let mut gross: i64 = 0;
    let mut full = false;
    for l in lines.iter().filter(|l| allow_sandbox || !l.sandbox) {
        if l.kind == ItemKind::Payment {
            if full {
                continue;
            }
            let next_gross = gross
                .checked_add(l.amount_minor)
                .ok_or(DomainError::Overflow)?;
            let next_net = next_gross
                .checked_sub(refunds)
                .ok_or(DomainError::Overflow)?;
            if next_net > available_minor {
                full = true;
                continue;
            }
            gross = next_gross;
        }
        items.push(l.clone());
    }
    let net = gross.checked_sub(refunds).ok_or(DomainError::Overflow)?;
    if net <= 0 {
        return Err(if skipped_sandbox && gross == 0 {
            DomainError::SandboxFunds
        } else {
            DomainError::NothingToSettle
        });
    }
    if net < minimum_minor {
        return Err(DomainError::BelowMinimum);
    }
    let period_start = items.first().map(|l| l.occurred_at).unwrap_or_default();
    let period_end = items.last().map(|l| l.occurred_at).unwrap_or_default();
    let sandbox = items.iter().any(|l| l.sandbox);
    Ok(Selection {
        items,
        gross_minor: gross,
        refunds_minor: refunds,
        net_minor: net,
        sandbox,
        period_start,
        period_end,
    })
}

/// Panamá es UTC−5 todo el año (domain-model §10.2).
fn panama_offset() -> Duration {
    Duration::hours(5)
}

/// Hora de corte de los calendarios: 17:00 en Panamá (SPEC §3 `cutoff_local`).
pub fn cutoff_local() -> NaiveTime {
    NaiveTime::from_hms_opt(17, 0, 0).unwrap_or_default()
}

/// Fecha y hora local de Panamá de un instante.
pub fn panama_local(t: DateTime<Utc>) -> chrono::NaiveDateTime {
    let utc = t.naive_utc();
    utc.checked_sub_signed(panama_offset()).unwrap_or(utc)
}

fn utc_of_local(d: chrono::NaiveDate) -> DateTime<Utc> {
    let local = d.and_time(cutoff_local());
    Utc.from_utc_datetime(&local.checked_add_signed(panama_offset()).unwrap_or(local))
}

/// Próxima liquidación automática: el corte de hoy si aún no pasó, si no el siguiente día que toca.
/// `weekday`: 1 = lunes … 7 = domingo. MANUAL no tiene fecha.
pub fn next_payout_at(freq: Frequency, weekday: i32, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let local = panama_local(now);
    let today = local.date();
    for offset in 0..8 {
        let day = today.checked_add_signed(Duration::days(offset))?;
        let at = utc_of_local(day);
        if at <= now {
            continue;
        }
        let ok = match freq {
            Frequency::Manual => return None,
            Frequency::Daily => true,
            Frequency::Weekly => {
                i64::from(day.weekday().number_from_monday()) == i64::from(weekday)
            }
        };
        if ok {
            return Some(at);
        }
    }
    None
}

/// ¿Le toca al calendario un lote automático en este momento? Devuelve la fecha local del corte que
/// ya pasó hoy (para la clave de idempotencia del job: un lote por día).
pub fn due_today(freq: Frequency, weekday: i32, now: DateTime<Utc>) -> Option<chrono::NaiveDate> {
    let local = panama_local(now);
    if local.time() < cutoff_local() {
        return None;
    }
    let day = local.date();
    match freq {
        Frequency::Manual => None,
        Frequency::Daily => Some(day),
        Frequency::Weekly => {
            (i64::from(day.weekday().number_from_monday()) == i64::from(weekday)).then_some(day)
        }
    }
}

/// Normaliza un nombre para comparar titulares: minúsculas, sin tildes ni signos, espacios simples
/// y sin la forma societaria final (S.A., Inc., Corp.).
pub fn normalize_name(s: &str) -> String {
    let folded: String = s
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'Á' | 'À' | 'Ä' => 'a',
            'é' | 'è' | 'ë' | 'É' | 'È' | 'Ë' => 'e',
            'í' | 'ì' | 'ï' | 'Í' | 'Ì' | 'Ï' => 'i',
            'ó' | 'ò' | 'ö' | 'Ó' | 'Ò' | 'Ö' => 'o',
            'ú' | 'ù' | 'ü' | 'Ú' | 'Ù' | 'Ü' => 'u',
            'ñ' | 'Ñ' => 'n',
            c if c.is_alphanumeric() => c.to_ascii_lowercase(),
            _ => ' ',
        })
        .collect();
    let mut words: Vec<&str> = folded.split_whitespace().collect();
    loop {
        let n = words.len();
        let tail2 = n
            .checked_sub(2)
            .and_then(|i| words.get(i..))
            .map(|w| w.join(" "));
        if tail2.as_deref() == Some("s a") {
            words.truncate(n.saturating_sub(2));
            continue;
        }
        match words.last() {
            Some(&("sa" | "inc" | "corp" | "srl")) => {
                words.pop();
            }
            _ => break,
        }
    }
    words.join(" ")
}

/// Un destino bancario declarado, ya validado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BankDestination {
    pub bank: String,
    pub account_type: String,
    pub account_number: String,
    pub holder: String,
}

impl BankDestination {
    pub fn last4(&self) -> String {
        let n = self.account_number.len();
        self.account_number
            .get(n.saturating_sub(4)..)
            .unwrap_or_default()
            .to_string()
    }
}

/// Valida un destino bancario (S-FIN-06 e4): banco, tipo, número de 6 a 20 dígitos y titular igual
/// al negocio (razón social o nombre comercial) o a su representante.
pub fn validate_bank(
    bank: &str,
    account_type: &str,
    account_number: &str,
    holder: &str,
    accepted_holders: &[&str],
) -> Result<BankDestination, DomainError> {
    let number: String = account_number
        .chars()
        .filter(|c| !matches!(c, ' ' | '-'))
        .collect();
    let bank = bank.trim();
    let holder = holder.trim();
    if !(6..=20).contains(&number.len())
        || !number.chars().all(|c| c.is_ascii_digit())
        || !(2..=60).contains(&bank.chars().count())
        || !matches!(account_type, "CHECKING" | "SAVINGS")
        || holder.is_empty()
        || holder.chars().count() > 120
    {
        return Err(DomainError::InvalidArgument);
    }
    let h = normalize_name(holder);
    if h.is_empty()
        || !accepted_holders
            .iter()
            .any(|a| !a.trim().is_empty() && normalize_name(a) == h)
    {
        return Err(DomainError::InvalidDestination);
    }
    Ok(BankDestination {
        bank: bank.to_string(),
        account_type: account_type.to_string(),
        account_number: number,
        holder: holder.to_string(),
    })
}

/// Clave de idempotencia de la API (grpc-conventions §3).
pub fn check_idempotency_key(k: &str) -> Result<(), DomainError> {
    if (16..=100).contains(&k.len()) {
        Ok(())
    } else {
        Err(DomainError::IdempotencyKeyRequired)
    }
}

#[cfg(test)]
#[allow(clippy::panic, clippy::arithmetic_side_effects)]
mod tests {
    use super::*;

    fn at(min: i64) -> DateTime<Utc> {
        Utc.timestamp_opt(1_792_500_000 + min * 60, 0)
            .single()
            .unwrap_or_default()
    }

    fn pay(amount: i64, min: i64, sandbox: bool) -> Line {
        Line {
            ledger_transaction_id: Uuid::now_v7(),
            kind: ItemKind::Payment,
            reference_type: "payment".into(),
            reference_id: Uuid::now_v7().to_string(),
            amount_minor: amount,
            occurred_at: at(min),
            sandbox,
        }
    }

    fn refund(amount: i64, min: i64) -> Line {
        Line {
            kind: ItemKind::Refund,
            reference_type: "refund".into(),
            ..pay(amount, min, false)
        }
    }

    /// Aceptación 1: 3 cobros del vector A (neto 9632) y el reembolso R1 (2432).
    #[test]
    fn acceptance1_vector_a_minus_r1() {
        let lines = vec![
            pay(9632, 1, false),
            pay(9632, 2, false),
            refund(2432, 3),
            pay(9632, 4, false),
        ];
        let s = select(&lines, 1_000_000, false, 100).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(s.gross_minor, 3 * 9632);
        assert_eq!(s.refunds_minor, 2432);
        assert_eq!(s.net_minor, 3 * 9632 - 2432);
        assert_eq!(s.items.len(), 4);
        assert!(!s.sandbox);
        assert_eq!((s.period_start, s.period_end), (at(1), at(4)));
    }

    /// R3: el disponible del ledger ya restó los reembolsos, aunque sean posteriores al último cobro.
    #[test]
    fn r3_refunds_count_even_if_later() {
        let lines = vec![
            pay(9632, 1, false),
            pay(9632, 2, false),
            pay(9632, 3, false),
            refund(2432, 4),
        ];
        let s = select(&lines, 3 * 9632 - 2432, false, 100).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(
            (s.gross_minor, s.refunds_minor, s.items.len()),
            (3 * 9632, 2432, 4)
        );
    }

    /// R3: el neto nunca supera lo disponible; los cobros que no caben esperan en orden.
    #[test]
    fn r3_net_never_exceeds_available() {
        let lines = vec![
            pay(5000, 1, false),
            pay(3000, 2, false),
            pay(1000, 3, false),
        ];
        let s = select(&lines, 7000, false, 100).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(
            s.net_minor, 5000,
            "el de 3000 no cabe y el de 1000 no se adelanta"
        );
        assert_eq!(s.items.len(), 1);
    }

    /// R2: con destino bancario los cobros de prueba no entran; con la billetera sí y el lote se marca.
    #[test]
    fn r2_sandbox_only_to_the_wallet() {
        let lines = vec![pay(4000, 1, true), pay(2000, 2, false)];
        let bank = select(&lines, 10_000, false, 100).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!((bank.net_minor, bank.sandbox), (2000, false));
        let wallet = select(&lines, 10_000, true, 100).unwrap_or_else(|e| panic!("{e}"));
        assert_eq!((wallet.net_minor, wallet.sandbox), (6000, true));
        assert_eq!(
            select(&[pay(4000, 1, true)], 10_000, false, 100),
            Err(DomainError::SandboxFunds)
        );
    }

    /// R6 y NOTHING_TO_SETTLE.
    #[test]
    fn r6_minimum_and_nothing_to_settle() {
        assert_eq!(
            select(&[], 10_000, true, 100),
            Err(DomainError::NothingToSettle)
        );
        assert_eq!(
            select(&[pay(1000, 1, false), refund(1000, 2)], 10_000, true, 100),
            Err(DomainError::NothingToSettle)
        );
        assert_eq!(
            select(&[pay(99, 1, false)], 10_000, true, 100),
            Err(DomainError::BelowMinimum)
        );
        assert_eq!(
            select(&[pay(-5, 1, false)], 10_000, true, 0),
            Err(DomainError::InvalidArgument)
        );
    }

    #[test]
    fn overflow_is_an_error() {
        assert_eq!(
            select(
                &[pay(i64::MAX, 1, false), pay(i64::MAX, 2, false)],
                i64::MAX,
                true,
                0
            )
            .map(|s| s.net_minor),
            Err(DomainError::Overflow),
            "ADR 0013: una suma que desborda es un error, nunca un monto truncado"
        );
    }

    /// R9: calendario en America/Panama con corte a las 17:00 (22:00 UTC).
    #[test]
    fn r9_schedule_in_panama_time() {
        let t = |s: &str| {
            DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_default()
        };
        // 2026-10-21 es miércoles. 15:00 en Panamá = 20:00 UTC.
        let now = t("2026-10-21T20:00:00Z");
        assert_eq!(
            next_payout_at(Frequency::Daily, 0, now),
            Some(t("2026-10-21T22:00:00Z"))
        );
        assert_eq!(
            next_payout_at(Frequency::Daily, 0, t("2026-10-21T23:00:00Z")),
            Some(t("2026-10-22T22:00:00Z"))
        );
        assert_eq!(
            next_payout_at(Frequency::Weekly, 5, now),
            Some(t("2026-10-23T22:00:00Z"))
        );
        assert_eq!(next_payout_at(Frequency::Manual, 0, now), None);
        assert_eq!(due_today(Frequency::Daily, 0, now), None, "antes del corte");
        let after = t("2026-10-21T22:30:00Z");
        assert_eq!(
            due_today(Frequency::Daily, 0, after).map(|d| d.to_string()),
            Some("2026-10-21".into())
        );
        assert_eq!(
            due_today(Frequency::Weekly, 3, after).map(|d| d.to_string()),
            Some("2026-10-21".into())
        );
        assert_eq!(due_today(Frequency::Weekly, 5, after), None);
        // 01:00 UTC del 22 todavía es el 21 en Panamá.
        assert_eq!(
            due_today(Frequency::Daily, 0, t("2026-10-22T01:00:00Z")).map(|d| d.to_string()),
            Some("2026-10-21".into())
        );
    }

    /// S-FIN-06 e4: el titular debe coincidir con el negocio; solo se guardan los últimos 4.
    #[test]
    fn invalid_destination_when_holder_differs() {
        let accepted = ["Barbería Demo S.A.", "Barbería Demo", "Bárbara Dueña"];
        let d = validate_bank(
            "Banco General",
            "CHECKING",
            "04-01-0012345-6",
            "barberia demo, s.a.",
            &accepted,
        )
        .unwrap_or_else(|e| panic!("{e}"));
        assert_eq!(d.account_number, "040100123456");
        assert_eq!(d.last4(), "3456");
        assert!(validate_bank(
            "Banco General",
            "SAVINGS",
            "123456789",
            "BÁRBARA DUEÑA",
            &accepted
        )
        .is_ok());
        assert_eq!(
            validate_bank(
                "Banco General",
                "CHECKING",
                "123456789",
                "Otra Persona",
                &accepted
            ),
            Err(DomainError::InvalidDestination)
        );
        for (bank, kind, number) in [
            ("B", "CHECKING", "123456789"),
            ("Banco", "PLAZO", "123456789"),
            ("Banco", "SAVINGS", "12345"),
            ("Banco", "SAVINGS", "12345678x"),
        ] {
            assert_eq!(
                validate_bank(bank, kind, number, "Barbería Demo", &accepted),
                Err(DomainError::InvalidArgument),
                "{bank} {kind} {number}"
            );
        }
        assert_eq!(
            normalize_name("  Café  La Esquina, S. A. "),
            "cafe la esquina"
        );
    }
}
