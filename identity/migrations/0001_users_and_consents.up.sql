-- PlentyPay - identity: esquema inicial de usuarios y consentimientos (F08.2)
-- Reglas del contenedor implementadas aqui: R1 (correo unico, normalizado),
-- R18 (consentimientos con version del texto, canal y dispositivo; N-DAT-02).
-- RLS: segunda barrera de tenencia (ADR 0014); go-standards.md seccion 3.6.
--
-- Las aplica el Job migrate-identity (data-standards.md seccion 5); nunca al
-- arrancar el servicio. En desarrollo: `identity migrate` (subcomando del binario).

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY,
  email            text NOT NULL,                -- tal y como llego (minus/mayus)
  email_normalized text NOT NULL,                -- minusculas: unica (R1)
  password_hash    text NOT NULL,                -- esquema sha256-bcrypt: (R19)
  full_name        text NOT NULL,
  role             text NOT NULL,                -- enum UserRole del .proto como texto
  tenant_id        uuid,                         -- NULL = cliente sin negocio (dominio 3.2)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_uidx ON users (email_normalized);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id) WHERE tenant_id IS NOT NULL;

-- Consentimientos: no se borran nunca; revocar agrega fila con granted=false (R18).
CREATE TABLE IF NOT EXISTS consents (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      text NOT NULL,
  text_version text NOT NULL,
  granted      boolean NOT NULL,
  channel      text NOT NULL DEFAULT '',
  device       text NOT NULL DEFAULT '',
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consents_user_idx ON consents (user_id, purpose);

-- --- RLS (ADR 0014: el tenant sale de los metadatos, nunca del cuerpo) --------
-- El store ejecuta SET LOCAL app.tenant_id / app.user_id / app.actor_role en cada
-- transaccion (identity/internal/store/postgres.go).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- Fail-closed: sin app.tenant_id/app.user_id no se ve ninguna fila, salvo que el
-- actor sea PLATFORM_ADMIN (RPC de plataforma explicitos y auditados).
DROP POLICY IF EXISTS users_tenencia ON users;
CREATE POLICY users_tenencia ON users
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR tenant_id::text = coalesce(nullif(current_setting('app.tenant_id', true), ''), '__sin_tenant__')
    OR id::text = current_setting('app.user_id', true)
  );

DROP POLICY IF EXISTS consents_tenencia ON consents;
CREATE POLICY consents_tenencia ON consents
  USING (
    coalesce(current_setting('app.actor_role', true), '') = 'PLATFORM_ADMIN'
    OR user_id::text = current_setting('app.user_id', true)
  );

-- El login aun no conoce tenant ni usuario: la busqueda por correo pasa por esta
-- funcion SECURITY DEFINER (unica via de autenticacion por email; R4). Debe ser
-- propiedad del migrador (owner de la tabla): solo asi bypasea RLS sin darle
-- BYPASSRLS al rol de servicio.
CREATE OR REPLACE FUNCTION find_user_by_email(p_email_normalized text)
RETURNS SETOF users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = identity, pg_temp
AS $$
  SELECT * FROM identity.users WHERE email_normalized = p_email_normalized;
$$;

ALTER FUNCTION find_user_by_email(text) OWNER TO migrator_identity;
REVOKE ALL ON FUNCTION find_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO identity_svc;

-- El DDL lo aplica migrator_identity (owner de las tablas): asi el rol de
-- servicio identity_svc NO es owner y RLS le aplica de verdad (sin FORCE,
-- PostgreSQL exime al owner). Los permisos DML se conceden explicitamente.
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.users TO identity_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.consents TO identity_svc;
GRANT USAGE, SELECT ON SEQUENCE identity.consents_id_seq TO identity_svc;

COMMIT;
