//! Adaptador tonic del contrato `ledger.proto`: traduce pb ↔ store, autoriza al llamador desde
//! los metadatos y traduce errores en `grpc/errors.rs`. Sin reglas de negocio propias.

use chrono::{DateTime, TimeZone, Utc};
use prost::Message;
use sha2::{Digest, Sha256};
use tonic::{Code, Request, Response, Status};
use uuid::Uuid;

use crate::domain::accounts::{AccountType, Side};
use crate::domain::templates::EntrySpec;
use crate::grpc::context::Caller;
use crate::grpc::errors::{status, to_status};
use crate::pb;
use crate::pb::ledger_server::Ledger;
use crate::store::{
    AccountView, CaptureCommand, EntryView, HoldCommand, HoldStatus, HoldView, PgLedger,
    PostCommand, ReadScope, StoreError, TransactionView,
};

pub struct LedgerService {
    store: PgLedger,
}

impl LedgerService {
    pub fn new(store: PgLedger) -> Self {
        Self { store }
    }
}

const MAX_PAGE: i64 = 200;
const DEFAULT_PAGE: i64 = 50;
const MAX_STATEMENT_DAYS: i64 = 366;

/// SHA-256 del request canónico sin la clave de idempotencia (R4).
fn request_hash<M: Message + Clone>(msg: &M, clear: impl FnOnce(&mut M)) -> Vec<u8> {
    let mut m = msg.clone();
    clear(&mut m);
    Sha256::digest(m.encode_to_vec()).to_vec()
}

fn invalid(reason: &str, message: &str) -> Status {
    status(Code::InvalidArgument, reason, message)
}

fn parse_uuid(s: &str, reason: &str) -> Result<Uuid, Status> {
    Uuid::parse_str(s).map_err(|_| invalid(reason, "identificador inválido"))
}

fn opt_uuid(s: &str) -> Result<Option<Uuid>, Status> {
    if s.is_empty() {
        Ok(None)
    } else {
        parse_uuid(s, "INVALID_ACCOUNT").map(Some)
    }
}

fn account_spec(
    a: Option<&pb::AccountRef>,
    side: Side,
    amount_minor: i64,
) -> Result<EntrySpec, Status> {
    let a = a.ok_or_else(|| invalid("INVALID_ACCOUNT", "falta la cuenta"))?;
    let account_type = AccountType::from_i32(a.r#type)
        .map_err(|_| invalid("INVALID_ACCOUNT", "tipo de cuenta inválido"))?;
    Ok(EntrySpec {
        party_id: a.party_id.clone(),
        account_type,
        currency: a.currency.clone(),
        scope_id: a.scope_id.clone(),
        side,
        amount_minor,
    })
}

fn side_from(v: i32) -> Result<Side, Status> {
    match v {
        x if x == pb::EntrySide::Debit as i32 => Ok(Side::Debit),
        x if x == pb::EntrySide::Credit as i32 => Ok(Side::Credit),
        _ => Err(invalid("INVALID_ACCOUNT", "lado del asiento inválido")),
    }
}

fn ts(d: DateTime<Utc>) -> prost_types::Timestamp {
    prost_types::Timestamp {
        seconds: d.timestamp(),
        nanos: i32::try_from(d.timestamp_subsec_nanos()).unwrap_or(0),
    }
}

fn from_ts(t: &prost_types::Timestamp) -> Result<DateTime<Utc>, Status> {
    let nanos = u32::try_from(t.nanos).map_err(|_| invalid("INVALID_RANGE", "fecha inválida"))?;
    Utc.timestamp_opt(t.seconds, nanos)
        .single()
        .ok_or_else(|| invalid("INVALID_RANGE", "fecha inválida"))
}

fn account_ref(a: &AccountView) -> pb::AccountRef {
    pb::AccountRef {
        party_id: a.party_id.clone(),
        r#type: i32::from(a.account_type.code()),
        currency: a.currency.clone(),
        scope_id: a.scope_id.clone(),
    }
}

fn entry_pb(e: &EntryView) -> pb::Entry {
    pb::Entry {
        entry_id: e.id.to_string(),
        account_id: e.account.id.to_string(),
        account: Some(account_ref(&e.account)),
        side: if e.side == Side::Debit {
            pb::EntrySide::Debit as i32
        } else {
            pb::EntrySide::Credit as i32
        },
        amount_minor: e.amount_minor,
    }
}

fn transaction_pb(t: &TransactionView) -> pb::Transaction {
    pb::Transaction {
        transaction_id: t.id.to_string(),
        tenant_id: t.tenant_id.map(|x| x.to_string()).unwrap_or_default(),
        transaction_type: t.transaction_type.clone(),
        reference: Some(pb::Reference {
            r#type: t.reference_type.clone(),
            id: t.reference_id.clone(),
        }),
        currency: t.currency.clone(),
        description: t.description.clone(),
        status: if t.reversed {
            pb::TransactionStatus::Reversed as i32
        } else {
            pb::TransactionStatus::Posted as i32
        },
        entries: t.entries.iter().map(entry_pb).collect(),
        reversal_of: t.reversal_of.map(|x| x.to_string()).unwrap_or_default(),
        effective_at: Some(ts(t.effective_at)),
        posted_at: t.posted_at.map(ts),
    }
}

fn hold_pb(h: &HoldView) -> pb::Hold {
    pb::Hold {
        hold_id: h.id.to_string(),
        account: Some(account_ref(&h.account)),
        amount_minor: h.amount_minor,
        status: match h.status {
            HoldStatus::Active => pb::HoldStatus::Active as i32,
            HoldStatus::Captured => pb::HoldStatus::Captured as i32,
            HoldStatus::Released => pb::HoldStatus::Released as i32,
            HoldStatus::Expired => pb::HoldStatus::Expired as i32,
        },
        reference: Some(pb::Reference {
            r#type: h.reference_type.clone(),
            id: h.reference_id.clone(),
        }),
        expires_at: Some(ts(h.expires_at)),
        created_at: Some(ts(h.created_at)),
    }
}

fn balance_pb(a: &AccountView) -> pb::Balance {
    pb::Balance {
        account: Some(account_ref(a)),
        posted_minor: a.balance_minor,
        held_minor: a.held_minor,
        available_minor: a.balance_minor.saturating_sub(a.held_minor),
        as_of: Some(ts(Utc::now())),
    }
}

fn page_size(p: Option<&pb::PageRequest>) -> i64 {
    match p.map(|p| i64::from(p.page_size)) {
        Some(n) if n > 0 => n.min(MAX_PAGE),
        _ => DEFAULT_PAGE,
    }
}

/// Token opaco de la página siguiente: `<posted_at_micros>.<id>`.
fn page_token(t: &TransactionView) -> String {
    format!(
        "{}.{}",
        t.posted_at.map(|p| p.timestamp_micros()).unwrap_or(0),
        t.id
    )
}

fn parse_page_token(s: &str) -> Result<Option<(DateTime<Utc>, Uuid)>, Status> {
    if s.is_empty() {
        return Ok(None);
    }
    let (micros, id) = s
        .split_once('.')
        .ok_or_else(|| invalid("INVALID_RANGE", "página inválida"))?;
    let micros: i64 = micros
        .parse()
        .map_err(|_| invalid("INVALID_RANGE", "página inválida"))?;
    let at = Utc
        .timestamp_micros(micros)
        .single()
        .ok_or_else(|| invalid("INVALID_RANGE", "página inválida"))?;
    Ok(Some((at, parse_uuid(id, "INVALID_RANGE")?)))
}

fn post_command(
    req: &pb::PostTransactionRequest,
    entries: Vec<EntrySpec>,
    hash: Vec<u8>,
) -> Result<PostCommand, Status> {
    Ok(PostCommand {
        idempotency_key: req.idempotency_key.clone(),
        request_hash: hash,
        tenant_id: opt_uuid(&req.tenant_id)?,
        transaction_type: req.transaction_type.clone(),
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
        currency: req.currency.clone(),
        description: req.description.clone(),
        entries,
        effective_at: req.effective_at.as_ref().map(from_ts).transpose()?,
    })
}

type R<T> = Result<Response<T>, Status>;

#[tonic::async_trait]
impl Ledger for LedgerService {
    #[tracing::instrument(skip_all, fields(rpc = "PostTransaction"))]
    async fn post_transaction(
        &self,
        request: Request<pb::PostTransactionRequest>,
    ) -> R<pb::Transaction> {
        Caller::from_metadata(request.metadata()).require_writer()?;
        let req = request.into_inner();
        let entries = req
            .entries
            .iter()
            .map(|e| account_spec(e.account.as_ref(), side_from(e.side)?, e.amount_minor))
            .collect::<Result<Vec<_>, _>>()?;
        let hash = request_hash(&req, |m| m.idempotency_key.clear());
        let cmd = post_command(&req, entries, hash)?;
        let t = self
            .store
            .post(cmd)
            .await
            .map_err(|e| to_status(e, "PostTransaction"))?;
        Ok(Response::new(transaction_pb(&t)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ReverseTransaction"))]
    async fn reverse_transaction(
        &self,
        request: Request<pb::ReverseTransactionRequest>,
    ) -> R<pb::Transaction> {
        Caller::from_metadata(request.metadata()).require_writer()?;
        let req = request.into_inner();
        let original = parse_uuid(&req.transaction_id, "NOT_FOUND")?;
        let key = if req.idempotency_key.is_empty() {
            format!("rev:{original}")
        } else {
            req.idempotency_key.clone()
        };
        let hash = request_hash(&req, |m| m.idempotency_key.clear());
        let t = self
            .store
            .reverse(original, key, hash, req.reason.clone())
            .await
            .map_err(|e| to_status(e, "ReverseTransaction"))?;
        Ok(Response::new(transaction_pb(&t)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetTransaction"))]
    async fn get_transaction(
        &self,
        request: Request<pb::GetTransactionRequest>,
    ) -> R<pb::Transaction> {
        let caller = Caller::from_metadata(request.metadata());
        let req = request.into_inner();
        let id = parse_uuid(&req.transaction_id, "NOT_FOUND")?;
        // Sin parte en el pedido: solo servicios; el gateway usa ListTransactions por parte.
        let scope = caller.read_scope("")?;
        let t = self
            .store
            .transaction(id, &scope)
            .await
            .map_err(|e| to_status(e, "GetTransaction"))?;
        Ok(Response::new(transaction_pb(&t)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ListTransactions"))]
    async fn list_transactions(
        &self,
        request: Request<pb::ListTransactionsRequest>,
    ) -> R<pb::ListTransactionsResponse> {
        let caller = Caller::from_metadata(request.metadata());
        let req = request.into_inner();
        let party = if req.party_id.is_empty() {
            req.tenant_id.clone()
        } else {
            req.party_id.clone()
        };
        let scope = caller.read_scope(&party)?;
        let limit = page_size(req.page.as_ref());
        let after = parse_page_token(
            req.page
                .as_ref()
                .map(|p| p.page_token.as_str())
                .unwrap_or_default(),
        )?;
        let reference = req
            .reference
            .as_ref()
            .filter(|r| !r.r#type.is_empty())
            .map(|r| (r.r#type.clone(), r.id.clone()));
        let list = self
            .store
            .list_transactions(
                &scope,
                opt_uuid(&req.party_id)?,
                opt_uuid(&req.tenant_id)?,
                reference,
                after,
                limit,
            )
            .await
            .map_err(|e| to_status(e, "ListTransactions"))?;
        let next = if i64::try_from(list.len()).unwrap_or(0) == limit {
            list.last().map(page_token).unwrap_or_default()
        } else {
            String::new()
        };
        Ok(Response::new(pb::ListTransactionsResponse {
            transactions: list.iter().map(transaction_pb).collect(),
            page: Some(pb::PageInfo {
                next_page_token: next,
            }),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetBalance"))]
    async fn get_balance(&self, request: Request<pb::GetBalanceRequest>) -> R<pb::Balance> {
        let caller = Caller::from_metadata(request.metadata());
        let req = request.into_inner();
        let spec = account_spec(req.account.as_ref(), Side::Debit, 1)?;
        let scope = caller.read_scope(&spec.party_id)?;
        let a = self
            .store
            .balance(&scope, &spec)
            .await
            .map_err(|e| to_status(e, "GetBalance"))?;
        Ok(Response::new(balance_pb(&a)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ListBalances"))]
    async fn list_balances(
        &self,
        request: Request<pb::ListBalancesRequest>,
    ) -> R<pb::ListBalancesResponse> {
        let caller = Caller::from_metadata(request.metadata());
        let req = request.into_inner();
        let scope = caller.read_scope(&req.party_id)?;
        let party = parse_uuid(&req.party_id, "INVALID_ACCOUNT")?;
        let list = self
            .store
            .balances(&scope, party)
            .await
            .map_err(|e| to_status(e, "ListBalances"))?;
        Ok(Response::new(pb::ListBalancesResponse {
            balances: list.iter().map(balance_pb).collect(),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetStatement"))]
    async fn get_statement(
        &self,
        request: Request<pb::GetStatementRequest>,
    ) -> R<pb::GetStatementResponse> {
        let caller = Caller::from_metadata(request.metadata());
        let req = request.into_inner();
        let spec = account_spec(req.account.as_ref(), Side::Debit, 1)?;
        let scope = caller.read_scope(&spec.party_id)?;
        let range = req
            .range
            .as_ref()
            .ok_or_else(|| invalid("INVALID_RANGE", "falta el rango"))?;
        let from = from_ts(
            range
                .from
                .as_ref()
                .ok_or_else(|| invalid("INVALID_RANGE", "falta el inicio"))?,
        )?;
        let to = range
            .to
            .as_ref()
            .map(from_ts)
            .transpose()?
            .unwrap_or_else(Utc::now);
        if to <= from || to.signed_duration_since(from).num_days() > MAX_STATEMENT_DAYS {
            return Err(invalid(
                "INVALID_RANGE",
                "el rango debe ser de hasta 366 días",
            ));
        }
        let (opening, lines) = self
            .store
            .statement(
                &scope,
                &spec,
                from,
                to,
                page_size(req.page.as_ref()).saturating_mul(10),
            )
            .await
            .map_err(|e| to_status(e, "GetStatement"))?;
        let closing = lines
            .last()
            .map(|l| l.running_balance_minor)
            .unwrap_or(opening);
        Ok(Response::new(pb::GetStatementResponse {
            opening_balance_minor: opening,
            lines: lines
                .iter()
                .map(|l| pb::LedgerStatementLine {
                    entry: Some(entry_pb(&l.entry)),
                    transaction_id: l.transaction_id.to_string(),
                    transaction_type: l.transaction_type.clone(),
                    description: l.description.clone(),
                    running_balance_minor: l.running_balance_minor,
                    effective_at: Some(ts(l.effective_at)),
                    reference: Some(pb::Reference {
                        r#type: l.reference_type.clone(),
                        id: l.reference_id.clone(),
                    }),
                })
                .collect(),
            closing_balance_minor: closing,
            page: Some(pb::PageInfo::default()),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "CreateHold"))]
    async fn create_hold(&self, request: Request<pb::CreateHoldRequest>) -> R<pb::Hold> {
        Caller::from_metadata(request.metadata()).require_writer()?;
        let req = request.into_inner();
        let spec = account_spec(req.account.as_ref(), Side::Debit, req.amount_minor)?;
        if spec.account_type != AccountType::Wallet {
            return Err(invalid(
                "INVALID_ACCOUNT",
                "solo se retiene sobre una billetera",
            ));
        }
        let hash = request_hash(&req, |m| m.idempotency_key.clear());
        let cmd = HoldCommand {
            idempotency_key: req.idempotency_key.clone(),
            request_hash: hash,
            party_id: spec.party_id,
            currency: spec.currency,
            scope_id: spec.scope_id,
            amount_minor: req.amount_minor,
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
            ttl_seconds: i64::from(req.ttl_seconds),
        };
        if cmd.idempotency_key.is_empty() {
            return Err(to_status(
                StoreError::Domain(crate::domain::errors::DomainError::IdempotencyKeyRequired),
                "CreateHold",
            ));
        }
        let h = self
            .store
            .create_hold(cmd)
            .await
            .map_err(|e| to_status(e, "CreateHold"))?;
        Ok(Response::new(hold_pb(&h)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "CaptureHold"))]
    async fn capture_hold(
        &self,
        request: Request<pb::CaptureHoldRequest>,
    ) -> R<pb::CaptureHoldResponse> {
        Caller::from_metadata(request.metadata()).require_writer()?;
        let req = request.into_inner();
        let hold_id = parse_uuid(&req.hold_id, "NOT_FOUND")?;
        let legs = req
            .legs
            .iter()
            .map(|l| account_spec(l.account.as_ref(), Side::Credit, l.amount_minor))
            .collect::<Result<Vec<_>, _>>()?;
        let hash = request_hash(&req, |m| m.idempotency_key.clear());
        let post = PostCommand {
            idempotency_key: req.idempotency_key.clone(),
            request_hash: hash,
            tenant_id: opt_uuid(&req.tenant_id)?,
            transaction_type: req.transaction_type.clone(),
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
            currency: String::new(), // la fija la cuenta del hold
            description: String::new(),
            entries: Vec::new(),
            effective_at: None,
        };
        let (h, t) = self
            .store
            .capture_hold(CaptureCommand {
                hold_id,
                post,
                legs,
            })
            .await
            .map_err(|e| to_status(e, "CaptureHold"))?;
        Ok(Response::new(pb::CaptureHoldResponse {
            hold: Some(hold_pb(&h)),
            transaction: Some(transaction_pb(&t)),
        }))
    }

    #[tracing::instrument(skip_all, fields(rpc = "ReleaseHold"))]
    async fn release_hold(&self, request: Request<pb::ReleaseHoldRequest>) -> R<pb::Hold> {
        Caller::from_metadata(request.metadata()).require_writer()?;
        let req = request.into_inner();
        let h = self
            .store
            .release_hold(parse_uuid(&req.hold_id, "NOT_FOUND")?)
            .await
            .map_err(|e| to_status(e, "ReleaseHold"))?;
        Ok(Response::new(hold_pb(&h)))
    }

    #[tracing::instrument(skip_all, fields(rpc = "GetHold"))]
    async fn get_hold(&self, request: Request<pb::GetHoldRequest>) -> R<pb::Hold> {
        // Las retenciones son del orquestador de pagos: solo las leen servicios de confianza.
        if !Caller::from_metadata(request.metadata())
            .read_scope("")?
            .service
        {
            return Err(status(Code::NotFound, "NOT_FOUND", "no encontrado"));
        }
        let req = request.into_inner();
        let h = self
            .store
            .hold(parse_uuid(&req.hold_id, "NOT_FOUND")?)
            .await
            .map_err(|e| to_status(e, "GetHold"))?;
        Ok(Response::new(hold_pb(&h)))
    }
}

/// Para lecturas internas sin parte: el servicio de confianza ya validado.
#[allow(dead_code)]
fn service_scope() -> ReadScope {
    ReadScope {
        service: true,
        ..Default::default()
    }
}
