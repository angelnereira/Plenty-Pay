-- name: CreateTenant :one
insert into identity.tenants (id, name, status)
values (@id, @name, @status)
returning id, name, status, created_at;

-- name: GetTenantByID :one
select id, name, status, created_at
from identity.tenants
where id = @id;

-- name: CreateUser :one
insert into identity.users (id, tenant_id, email, password_hash, status, roles)
values (@id, @tenant_id, @email, @password_hash, @status, @roles)
returning id, tenant_id, email, password_hash, status, roles, created_at;

-- name: GetUserByEmail :one
select id, tenant_id, email, password_hash, status, roles, created_at
from identity.users
where lower(email) = lower(@email);

-- name: GetUserByID :one
select id, tenant_id, email, password_hash, status, roles, created_at
from identity.users
where id = @id;

-- name: CreateSession :one
insert into identity.sessions (id, user_id, tenant_id, token_hash, expires_at)
values (@id, @user_id, @tenant_id, @token_hash, @expires_at)
returning id, user_id, tenant_id, token_hash, expires_at, revoked;

-- name: GetSessionByToken :one
select id, user_id, tenant_id, token_hash, expires_at, revoked
from identity.sessions
where token_hash = @token_hash
  and revoked = false
  and expires_at > now();

-- name: RevokeSessionByToken :exec
update identity.sessions
set revoked = true
where token_hash = @token_hash;

-- name: InsertAudit :exec
insert into identity.audit_log (id, event, user_id, tenant_id, detail)
values (@id, @event, sqlc.narg('user_id'), sqlc.narg('tenant_id'), @detail::jsonb);

-- name: CountAuditByEvent :one
select count(*)::bigint as n
from identity.audit_log
where event = @event;
