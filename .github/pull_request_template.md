## Paso del roadmap
F<nn>.<m> — <título> · Reglas: R<n>, …

## Qué cambia
<!-- breve; enlaza SPEC/ADR modificados -->

## Verificación (pegar salida real)
- Nivel exigido: L?
```
<salida de los comandos>
```

## Definición de Hecho (testing-strategy.md §7)
- [ ] Criterio de aceptación demostrado con el nivel exigido
- [ ] Una prueba por regla R<n> tocada (+ permisos, tenant, idempotencia si aplica)
- [ ] SPEC.md / .proto actualizados y `sync-protos.sh --check` en verde
- [ ] README del contenedor y `docs/roadmap/status.md` actualizados con evidencia
- [ ] Métricas/logs/trazas según estándar
- [ ] Checklist de seguridad (security-standards.md §14)
- [ ] `check-isolation.sh` y `check-docs.sh` en verde
- [ ] Sin secretos, sin TODO sin issue
