//! Implementación del servicio `Payments` (payments.proto). Cada RPC: actor de los metadatos →
//! traducción del mensaje → caso de uso → traducción de la respuesta o del error.

use std::collections::BTreeMap;
use std::sync::Arc;

use chrono::{DateTime, TimeZone, Utc};
use prost::Message;
use sha2::{Digest, Sha256};
use tonic::{Request, Response, Status};
use uuid::Uuid;

use crate::domain::fees::FeeBreakdown;
use crate::grpc::context::actor;
use crate::grpc::errors::{status, to_status};
use crate::pb;
use crate::pb::payments_server::Payments;
use crate::service::{CreateIntent, IntentView, PaymentsCore, SplitInput};
use crate::store::{FeePolicyRow, PaymentFilter, PaymentRow, TerminalRow};

type R<T> = Result<Response<T>, Status>;

pub struct PaymentsService {
    core: Arc<PaymentsCore>,
}

impl PaymentsService {
    pub fn new(core: Arc<PaymentsCore>) -> Self {
        Self { core }
    }
}

fn ts(t: DateTime<Utc>) -> prost_types::Timestamp {
    prost_types::Timestamp {
        seconds: t.timestamp(),
        nanos: i32::try_from(t.timestamp_subsec_nanos()).unwrap_or(0),
    }
}

fn from_ts(t: &prost_types::Timestamp) -> Option<DateTime<Utc>> {
    Utc.timestamp_opt(t.seconds, u32::try_from(t.nanos).ok()?)
        .single()
}

fn money(amount_minor: i64, currency: &str) -> Option<pb::Money> {
    Some(pb::Money {
        amount_minor,
        currency: currency.to_string(),
    })
}

fn uuid(s: &str) -> Result<Uuid, Status> {
    Uuid::parse_str(s).map_err(|_| status(tonic::Code::NotFound, "NOT_FOUND", "no encontrado"))
}

fn sha256(parts: &[&[u8]]) -> Vec<u8> {
    let mut h = Sha256::new();
    for p in parts {
        h.update((p.len() as u64).to_be_bytes());
        h.update(p);
    }
    h.finalize().to_vec()
}

/// Hash canónico de CreatePaymentIntent (R1): sin la clave ni el token de step-up (de un solo uso)
/// y con `metadata` ordenada (un `map` de protobuf no tiene orden estable al serializar).
fn create_hash(req: &pb::CreatePaymentIntentRequest) -> Vec<u8> {
    let mut c = req.clone();
    c.idempotency_key.clear();
    c.step_up_token.clear();
    c.metadata.clear();
    let body = c.encode_to_vec();
    let meta: BTreeMap<_, _> = req.metadata.iter().collect();
    let meta = serde_json::to_vec(&meta).unwrap_or_default();
    sha256(&[&body, &meta])
}

pub fn fees_pb(b: &FeeBreakdown, currency: &str) -> pb::FeeBreakdown {
    let mut lines = Vec::new();
    for (kind, amount) in [
        ("PLATFORM", b.platform_fee_minor),
        ("TAX", b.tax_minor),
        ("RAIL", b.rail_fee_minor),
    ] {
        if amount > 0 {
            lines.push(pb::FeeLine {
                kind: kind.into(),
                amount: money(amount, currency),
            });
        }
    }
    // Invariante del contrato: gross == merchant_net + Σ lines (con portador CUSTOMER, gross es
    // lo cobrado al pagador).
    pb::FeeBreakdown {
        gross: money(b.total_charged_minor, currency),
        merchant_net: money(b.merchant_net_minor, currency),
        lines,
    }
}

fn payment_pb(p: &PaymentRow) -> pb::Payment {
    let fees = p.fees.as_ref().map(|f| {
        let sum = |g: fn(&crate::store::SplitFees) -> i64| f.splits.iter().map(g).sum::<i64>();
        fees_pb(
            &FeeBreakdown {
                gross_minor: sum(|s| s.gross_minor),
                platform_fee_minor: sum(|s| s.platform_fee_minor),
                tax_minor: sum(|s| s.tax_minor),
                rail_fee_minor: sum(|s| s.rail_fee_minor),
                merchant_net_minor: sum(|s| s.merchant_net_minor),
                total_charged_minor: sum(|s| s.total_charged_minor),
            },
            &p.currency,
        )
    });
    pb::Payment {
        payment_id: p.id.to_string(),
        payment_intent_id: p.intent_id.to_string(),
        tenant_id: p.tenant_id.to_string(),
        status: i32::from(p.status.code()),
        amount: money(p.amount_minor, &p.currency),
        captured: money(p.captured_minor, &p.currency),
        refunded: money(p.refunded_minor, &p.currency),
        fees,
        ledger_status: i32::from(p.ledger_posting),
        attempts: p
            .attempts
            .iter()
            .map(|a| pb::PaymentAttempt {
                attempt_id: a.id.to_string(),
                attempt_number: a.attempt_number,
                rail: i32::from(a.rail),
                status: i32::from(a.status.code()),
                external_ref: a.external_ref.clone(),
                failure_code: a.error_code.clone(),
                created_at: Some(ts(a.created_at)),
            })
            .collect(),
        created_at: Some(ts(p.created_at)),
        captured_at: p.captured_at.map(ts),
    }
}

fn intent_pb(v: &IntentView) -> pb::PaymentIntent {
    let i = &v.intent;
    pb::PaymentIntent {
        payment_intent_id: i.id.to_string(),
        tenant_id: i.tenant_id.to_string(),
        amount: money(i.amount_minor, &i.currency),
        rail: i32::from(i.rail),
        status: i32::from(i.status.code()),
        payer_party_id: i.payer_party_id.map(|p| p.to_string()).unwrap_or_default(),
        splits: i
            .splits
            .iter()
            .map(|s| pb::Split {
                merchant_party_id: s.merchant_party_id.to_string(),
                amount: money(s.amount_minor, &i.currency),
                reference: (!s.reference_type.is_empty()).then(|| pb::Reference {
                    r#type: s.reference_type.clone(),
                    id: s.reference_id.clone(),
                }),
            })
            .collect(),
        reference: (!i.reference_type.is_empty()).then(|| pb::Reference {
            r#type: i.reference_type.clone(),
            id: i.reference_id.clone(),
        }),
        next_action: None,
        sandbox: i.sandbox,
        payment_id: v
            .payment
            .as_ref()
            .map(|p| p.id.to_string())
            .unwrap_or_default(),
        created_at: Some(ts(i.created_at)),
        expires_at: Some(ts(i.expires_at)),
    }
}

fn terminal_pb(t: &TerminalRow) -> pb::Terminal {
    pb::Terminal {
        terminal_id: t.id.to_string(),
        tenant_id: t.tenant_id.to_string(),
        public_code: t.public_code.clone(),
        label: t.label.clone(),
        active: t.active,
        created_at: Some(ts(t.created_at)),
    }
}

fn policy_pb(p: &FeePolicyRow) -> pb::FeePolicy {
    pb::FeePolicy {
        fee_policy_id: p.id.to_string(),
        tenant_id: p.tenant_id.map(|t| t.to_string()).unwrap_or_default(),
        rail: i32::from(p.rail),
        fixed_fee_minor: p.fixed_fee_minor,
        percentage_bps: p.percentage_bps,
        bearer: i32::from(p.bearer),
        tax_rate_bps: p.tax_rate_bps,
        active: p.active,
        effective_from: Some(ts(p.effective_from)),
        rail_fixed_fee_minor: p.rail_fixed_fee_minor,
        rail_percentage_bps: p.rail_percentage_bps,
        rail_fee_refundable: p.rail_fee_refundable,
    }
}

fn rail(code: i32) -> i16 {
    i16::try_from(code).unwrap_or(0)
}

/// Página (common.PageRequest): 1..200, 50 por defecto; el token es `<micros>_<uuid>`.
fn page(req: Option<&pb::PageRequest>) -> (i64, Option<(DateTime<Utc>, Uuid)>) {
    let size = req.map(|p| p.page_size).unwrap_or(0);
    let size = if (1..=200).contains(&size) {
        i64::from(size)
    } else {
        50
    };
    let after = req.and_then(|p| {
        let (micros, id) = p.page_token.split_once('_')?;
        Some((
            Utc.timestamp_micros(micros.parse().ok()?).single()?,
            Uuid::parse_str(id).ok()?,
        ))
    });
    (size, after)
}

fn unimplemented(step: &str) -> Status {
    Status::unimplemented(format!("disponible en {step}"))
}

#[tonic::async_trait]
impl Payments for PaymentsService {
    #[tracing::instrument(skip_all, fields(rpc = "CreatePaymentIntent"))]
    async fn create_payment_intent(
        &self,
        request: Request<pb::CreatePaymentIntentRequest>,
    ) -> R<pb::PaymentIntent> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let amount = req.amount.clone().unwrap_or_default();
        let mut splits = Vec::with_capacity(req.splits.len());
        for s in &req.splits {
            let merchant = Uuid::parse_str(&s.merchant_party_id).map_err(|_| {
                status(
                    tonic::Code::InvalidArgument,
                    "SPLITS_MISMATCH",
                    "comercio del reparto inválido",
                )
            })?;
            let m = s.amount.clone().unwrap_or_default();
            if m.currency != amount.currency {
                return Err(status(
                    tonic::Code::InvalidArgument,
                    "CURRENCY_MISMATCH",
                    "moneda distinta a la del cobro",
                ));
            }
            splits.push(SplitInput {
                merchant_party_id: merchant,
                amount_minor: m.amount_minor,
                reference_type: s
                    .reference
                    .as_ref()
                    .map(|r| r.r#type.clone())
                    .unwrap_or_default(),
                reference_id: s
                    .reference
                    .as_ref()
                    .map(|r| r.id.clone())
                    .unwrap_or_default(),
            });
        }
        let cmd = CreateIntent {
            request_hash: create_hash(&req),
            idempotency_key: req.idempotency_key,
            amount_minor: amount.amount_minor,
            currency: amount.currency,
            rail: rail(req.rail),
            terminal_code: req.terminal_code,
            splits,
            reference_type: req
                .reference
                .as_ref()
                .map(|r| r.r#type.clone())
                .unwrap_or_default(),
            reference_id: req
                .reference
                .as_ref()
                .map(|r| r.id.clone())
                .unwrap_or_default(),
            metadata: req.metadata.into_iter().collect(),
            expires_in_seconds: req.expires_in_seconds,
            step_up_token: req.step_up_token,
        };
        let v = self
            .core
            .create_intent(&a, cmd)
            .await
            .map_err(|e| to_status(e, "CreatePaymentIntent", &a.request_id))?;
        Ok(Response::new(intent_pb(&v)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ConfirmPaymentIntent"))]
    async fn confirm_payment_intent(
        &self,
        request: Request<pb::ConfirmPaymentIntentRequest>,
    ) -> R<pb::PaymentIntent> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let id = uuid(&req.payment_intent_id)?;
        let data: BTreeMap<String, String> = req.confirmation_data.into_iter().collect();
        let v = self
            .core
            .confirm_intent(&a, id, &req.idempotency_key, &data)
            .await
            .map_err(|e| to_status(e, "ConfirmPaymentIntent", &a.request_id))?;
        Ok(Response::new(intent_pb(&v)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "CancelPaymentIntent"))]
    async fn cancel_payment_intent(
        &self,
        request: Request<pb::CancelPaymentIntentRequest>,
    ) -> R<pb::PaymentIntent> {
        let a = actor(request.metadata());
        let id = uuid(&request.get_ref().payment_intent_id)?;
        let v = self
            .core
            .cancel_intent(&a, id)
            .await
            .map_err(|e| to_status(e, "CancelPaymentIntent", &a.request_id))?;
        Ok(Response::new(intent_pb(&v)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetPaymentIntent"))]
    async fn get_payment_intent(
        &self,
        request: Request<pb::GetPaymentIntentRequest>,
    ) -> R<pb::PaymentIntent> {
        let a = actor(request.metadata());
        let id = uuid(&request.get_ref().payment_intent_id)?;
        let v = self
            .core
            .get_intent(&a, id)
            .await
            .map_err(|e| to_status(e, "GetPaymentIntent", &a.request_id))?;
        Ok(Response::new(intent_pb(&v)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ListPayments"))]
    async fn list_payments(
        &self,
        request: Request<pb::ListPaymentsRequest>,
    ) -> R<pb::ListPaymentsResponse> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let (limit, after) = page(req.page.as_ref());
        let filter = PaymentFilter {
            status: (req.status != 0).then(|| rail(req.status)),
            rail: (req.rail != 0).then(|| rail(req.rail)),
            from: req
                .range
                .as_ref()
                .and_then(|r| r.from.as_ref())
                .and_then(from_ts),
            to: req
                .range
                .as_ref()
                .and_then(|r| r.to.as_ref())
                .and_then(from_ts),
            reference_type: req
                .reference
                .as_ref()
                .map(|r| r.r#type.clone())
                .unwrap_or_default(),
            reference_id: req
                .reference
                .as_ref()
                .map(|r| r.id.clone())
                .unwrap_or_default(),
            after,
            limit,
        };
        let rows = self
            .core
            .list_payments(&a, filter)
            .await
            .map_err(|e| to_status(e, "ListPayments", &a.request_id))?;
        let next = if i64::try_from(rows.len()).unwrap_or(0) == limit {
            rows.last()
                .map(|p| format!("{}_{}", p.created_at.timestamp_micros(), p.id))
                .unwrap_or_default()
        } else {
            String::new()
        };
        Ok(Response::new(pb::ListPaymentsResponse {
            payments: rows.iter().map(payment_pb).collect(),
            page: Some(pb::PageInfo {
                next_page_token: next,
            }),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetPayment"))]
    async fn get_payment(&self, request: Request<pb::GetPaymentRequest>) -> R<pb::Payment> {
        let a = actor(request.metadata());
        let id = uuid(&request.get_ref().payment_id)?;
        let p = self
            .core
            .get_payment(&a, id)
            .await
            .map_err(|e| to_status(e, "GetPayment", &a.request_id))?;
        Ok(Response::new(payment_pb(&p)))
    }

    async fn refund_payment(&self, _: Request<pb::RefundPaymentRequest>) -> R<pb::Refund> {
        Err(unimplemented("F11.6"))
    }

    async fn get_refund(&self, _: Request<pb::GetRefundRequest>) -> R<pb::Refund> {
        Err(unimplemented("F11.6"))
    }

    #[tracing::instrument(skip_all, fields(rpc = "CreateTerminal"))]
    async fn create_terminal(
        &self,
        request: Request<pb::CreateTerminalRequest>,
    ) -> R<pb::Terminal> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let t = self
            .core
            .create_terminal(&a, &req.label, &req.idempotency_key)
            .await
            .map_err(|e| to_status(e, "CreateTerminal", &a.request_id))?;
        Ok(Response::new(terminal_pb(&t)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ListTerminals"))]
    async fn list_terminals(
        &self,
        request: Request<pb::ListTerminalsRequest>,
    ) -> R<pb::ListTerminalsResponse> {
        let a = actor(request.metadata());
        let rows = self
            .core
            .list_terminals(&a)
            .await
            .map_err(|e| to_status(e, "ListTerminals", &a.request_id))?;
        Ok(Response::new(pb::ListTerminalsResponse {
            terminals: rows.iter().map(terminal_pb).collect(),
            page: Some(pb::PageInfo::default()),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "SetTerminalActive"))]
    async fn set_terminal_active(
        &self,
        request: Request<pb::SetTerminalActiveRequest>,
    ) -> R<pb::Terminal> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let t = self
            .core
            .set_terminal_active(&a, uuid(&req.terminal_id)?, req.active)
            .await
            .map_err(|e| to_status(e, "SetTerminalActive", &a.request_id))?;
        Ok(Response::new(terminal_pb(&t)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ResolveTerminal"))]
    async fn resolve_terminal(
        &self,
        request: Request<pb::ResolveTerminalRequest>,
    ) -> R<pb::PublicTerminalInfo> {
        let a = actor(request.metadata());
        let (t, name) = self
            .core
            .resolve_terminal(&a, &request.get_ref().public_code)
            .await
            .map_err(|e| to_status(e, "ResolveTerminal", &a.request_id))?;
        Ok(Response::new(pb::PublicTerminalInfo {
            public_code: t.public_code,
            label: t.label,
            merchant_name: name,
            active: t.active,
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "QuoteFees"))]
    async fn quote_fees(&self, request: Request<pb::QuoteFeesRequest>) -> R<pb::FeeBreakdown> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let m = req.amount.unwrap_or_default();
        let b = self
            .core
            .quote(&a, m.amount_minor, &m.currency, rail(req.rail))
            .await
            .map_err(|e| to_status(e, "QuoteFees", &a.request_id))?;
        Ok(Response::new(fees_pb(&b, &m.currency)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "UpsertFeePolicy"))]
    async fn upsert_fee_policy(
        &self,
        request: Request<pb::UpsertFeePolicyRequest>,
    ) -> R<pb::FeePolicy> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let p = req.policy.clone().unwrap_or_default();
        let invalid = || {
            status(
                tonic::Code::InvalidArgument,
                "INVALID_FEE_POLICY",
                "política de comisión inválida",
            )
        };
        let tenant_id = if p.tenant_id.is_empty() {
            None
        } else {
            Some(Uuid::parse_str(&p.tenant_id).map_err(|_| invalid())?)
        };
        let mut hashed = req.clone();
        hashed.idempotency_key.clear();
        let row = FeePolicyRow {
            id: Uuid::now_v7(),
            tenant_id,
            rail: rail(p.rail),
            fixed_fee_minor: p.fixed_fee_minor,
            percentage_bps: p.percentage_bps,
            bearer: i16::try_from(p.bearer).map_err(|_| invalid())?,
            tax_rate_bps: p.tax_rate_bps,
            rail_fixed_fee_minor: p.rail_fixed_fee_minor,
            rail_percentage_bps: p.rail_percentage_bps,
            rail_fee_refundable: p.rail_fee_refundable,
            active: p.active,
            effective_from: p
                .effective_from
                .as_ref()
                .and_then(from_ts)
                .unwrap_or_else(Utc::now),
        };
        let out = self
            .core
            .upsert_fee_policy(
                &a,
                row,
                &req.idempotency_key,
                sha256(&[&hashed.encode_to_vec()]),
            )
            .await
            .map_err(|e| to_status(e, "UpsertFeePolicy", &a.request_id))?;
        Ok(Response::new(policy_pb(&out)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ListFeePolicies"))]
    async fn list_fee_policies(
        &self,
        request: Request<pb::ListFeePoliciesRequest>,
    ) -> R<pb::ListFeePoliciesResponse> {
        let a = actor(request.metadata());
        let t = &request.get_ref().tenant_id;
        let tenant = if t.is_empty() { None } else { Some(uuid(t)?) };
        let rows = self
            .core
            .list_fee_policies(&a, tenant)
            .await
            .map_err(|e| to_status(e, "ListFeePolicies", &a.request_id))?;
        Ok(Response::new(pb::ListFeePoliciesResponse {
            policies: rows.iter().map(policy_pb).collect(),
        }))
    }

    async fn handle_rail_webhook(
        &self,
        _: Request<pb::HandleRailWebhookRequest>,
    ) -> R<pb::HandleRailWebhookResponse> {
        // Fail-closed (R12): sin adaptador de riel no se acepta ningún webhook.
        Err(unimplemented("F11.8"))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ResolveUnknownPayment"))]
    async fn resolve_unknown_payment(
        &self,
        request: Request<pb::ResolveUnknownPaymentRequest>,
    ) -> R<pb::Payment> {
        let a = actor(request.metadata());
        let req = request.into_inner();
        let resolution = i16::try_from(req.resolution)
            .ok()
            .and_then(crate::domain::state::PaymentStatus::from_code)
            .ok_or_else(|| {
                status(
                    tonic::Code::InvalidArgument,
                    "INVALID_STATE_TRANSITION",
                    "resolución inválida",
                )
            })?;
        let p = self
            .core
            .resolve_unknown(&a, uuid(&req.payment_id)?, resolution, &req.evidence)
            .await
            .map_err(|e| to_status(e, "ResolveUnknownPayment", &a.request_id))?;
        Ok(Response::new(payment_pb(&p)))
    }

    async fn post_memo_entry(&self, _: Request<pb::PostMemoEntryRequest>) -> R<pb::MemoEntry> {
        Err(unimplemented("F17"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// R1: el hash no depende del orden de `metadata` ni de la clave/token de un solo uso.
    #[test]
    fn r1_request_hash_is_canonical() {
        let mut a = pb::CreatePaymentIntentRequest {
            idempotency_key: "k1".into(),
            step_up_token: "t1".into(),
            ..Default::default()
        };
        for i in 0..10 {
            a.metadata.insert(format!("k{i}"), format!("v{i}"));
        }
        let mut b = a.clone();
        b.idempotency_key = "k2".into();
        b.step_up_token = "t2".into();
        let mut sorted: Vec<_> = a.metadata.iter().collect();
        sorted.sort();
        sorted.reverse();
        b.metadata = sorted
            .into_iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        assert_eq!(create_hash(&a), create_hash(&b));
        b.metadata.insert("k0".into(), "otro".into());
        assert_ne!(create_hash(&a), create_hash(&b));
    }

    /// Contrato: gross == merchant_net + Σ lines también con portador CUSTOMER (vector D).
    #[test]
    fn fee_breakdown_invariant_holds_in_the_contract() {
        let b = FeeBreakdown {
            gross_minor: 5000,
            platform_fee_minor: 135,
            tax_minor: 9,
            rail_fee_minor: 0,
            merchant_net_minor: 5000,
            total_charged_minor: 5144,
        };
        let p = fees_pb(&b, "USD");
        let lines: i64 = p
            .lines
            .iter()
            .filter_map(|l| l.amount.as_ref())
            .map(|m| m.amount_minor)
            .sum();
        assert_eq!(p.gross.map(|g| g.amount_minor), Some(5000 + lines));
    }
}
