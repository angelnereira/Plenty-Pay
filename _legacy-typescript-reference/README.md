# _legacy-typescript-reference — solo referencia, no se despliega

Código del sistema de origen (Next.js/TypeScript/Prisma) y de la primera migración (servicios Node, app Flutter inicial, manifiestos K8s/Terraform de esa versión). **No forma parte de PlentyPay** (ADR 0001): se conserva únicamente para consultar reglas de negocio ya probadas (cálculos fiscales, flujos de pantallas, la migración SQL del ledger que `scripts/ledger-tests` usa como especificación ejecutable).

Reglas:
- Nunca se importa, copia ni construye desde aquí. `check-isolation.sh` lo excluye.
- Si una regla de aquí es necesaria, se **documenta** en el SPEC del contenedor correspondiente y se implementa desde el SPEC.
- Se eliminará cuando F30 cierre y `scripts/ledger-tests` se haya portado a `ledger/tests/`.
