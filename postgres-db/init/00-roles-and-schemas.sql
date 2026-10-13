-- PlentyPay — PostgreSQL 16 + PostGIS
-- Inicialización de esquemas y roles por contenedor (ADR 0014, data-standards.md §1, postgres-db/SPEC.md §4)

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Revocar acceso al esquema público para todos los usuarios (aislamiento estricto)
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Rol de operaciones de solo lectura (auditado)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'readonly_ops') THEN
    CREATE ROLE readonly_ops WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'readonly_ops_dev_pass';
  END IF;
END
$$;

-- Crear los 16 esquemas y sus respectivos roles de servicio y migración
DO $$
DECLARE
  schemas text[] := ARRAY[
    'identity', 'ledger', 'payments', 'settlement', 'fiscal',
    'catalog', 'inventory', 'orders', 'pos', 'logistics',
    'geo', 'payroll', 'notifications', 'analytics', 'security', 'infra'
  ];
  s text;
  svc_role text;
  mig_role text;
  default_pass text;
BEGIN
  FOREACH s IN ARRAY schemas LOOP
    svc_role := s || '_svc';
    mig_role := 'migrator_' || s;
    default_pass := s || '_svc_dev_secret_32_chars!';

    -- 1. Crear esquema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);

    -- 2. Crear rol de servicio
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = svc_role) THEN
      EXECUTE format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', svc_role, default_pass);
    END IF;

    -- 3. Crear rol de migración (DDL)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = mig_role) THEN
      EXECUTE format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', mig_role, default_pass || '_mig');
    END IF;

    -- 4. Permisos mínimos y search_path (aislamiento por contenedor)
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO %I', s, svc_role);
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO %I', s, mig_role);
    EXECUTE format('ALTER ROLE %I SET search_path = %I', svc_role, s);
    EXECUTE format('ALTER ROLE %I SET search_path = %I', mig_role, s);

    -- Permisos por defecto para tablas y secuencias futuras
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', s, svc_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', s, mig_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', s, svc_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', s, mig_role);

    -- Permitir solo lectura al rol readonly_ops sobre tablas creadas por postgres, el servicio o migrador
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO readonly_ops', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO readonly_ops', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON TABLES TO readonly_ops', svc_role, s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON TABLES TO readonly_ops', mig_role, s);
  END LOOP;
END
$$;
