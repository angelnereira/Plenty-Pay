-- PlentyPay - inventory: sucursal de cada bodega (F16.9, R11, ADR 0018).
-- NULL = Casa Matriz aún sin asignar: inventory la completa la primera vez que alguien con alcance
-- de todo el negocio lista las bodegas (consulta `ListBranches` a identity). No se rellena aquí:
-- las sucursales son de identity y inventory no lee su esquema.
BEGIN;
ALTER TABLE warehouses ADD COLUMN branch_id uuid;
CREATE INDEX warehouses_by_branch ON warehouses (tenant_id, branch_id);
COMMIT;
