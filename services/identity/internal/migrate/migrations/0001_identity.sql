-- 0001_identity.sql — Esquema inicial del servicio identity.
-- Reglas: esquema propio identity.* (aislamiento por servicio, mandato §18);
-- email global único v1 (login no tenant-scoped, ver README del servicio);
-- sesiones guardan SOLO hash del token (defense in depth, §13).

create schema if not exists identity;

create table if not exists identity.tenants (
  id          text primary key,
  name        text not null,
  status      text not null,
  created_at  timestamptz not null default now()
);
-- Nombre de tenant único (control de duplicados de negocio).
create unique index if not exists tenants_name_uq on identity.tenants (lower(name));

create table if not exists identity.users (
  id             text primary key,
  tenant_id      text not null references identity.tenants(id),
  email          text not null,
  password_hash  text not null,
  status         text not null,
  roles          text[] not null,
  created_at     timestamptz not null default now()
);
-- Regla v1: email es el identificador global de login (único entre tenants).
create unique index if not exists users_email_glob_uq on identity.users (lower(email));
-- Y único dentro del tenant (aún si la regla global cambiara).
create unique index if not exists users_tenant_email_uq on identity.users (tenant_id, lower(email));

create table if not exists identity.sessions (
  id          text primary key,
  user_id     text not null,
  tenant_id   text not null,
  token_hash  text not null,
  expires_at  timestamptz not null,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists sessions_token_hash_uq on identity.sessions (token_hash);
create index if not exists sessions_user_idx on identity.sessions (user_id);

-- Auditoría append-only de acciones de identidad (mandato §13).
create table if not exists identity.audit_log (
  id          text primary key,
  event       text not null,
  user_id     text,
  tenant_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_user_idx on identity.audit_log (user_id, created_at);
create index if not exists audit_event_idx on identity.audit_log (event, created_at);
