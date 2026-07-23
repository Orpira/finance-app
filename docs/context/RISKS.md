# Risks Register

## Matriz de riesgos

| ID | Riesgo | Probabilidad | Impacto | Estado | Mitigación |
|---|---|---|---|---|---|
| R-001 | Ramas n8n sin respuesta final | Alta | Alto | Abierto | Auditoría de ramas + `Respond to Webhook` obligatorio |
| R-002 | Divergencia por referencias legacy en workflows | Media | Alto | Abierto | Convergencia a `communication_channels` y `license_devices` |
| R-003 | Ambigüedad de criterio de certificación | Media | Medio | Abierto | ADR formal de criterio de cierre |
| R-004 | Crecimiento de IndexedDB por append-only | Media | Medio | Abierto | Política de retención/archivado no destructiva |
| R-005 | Regresión por cambios de dependencias externas | Media | Alto | Abierto | Gate técnico previo a release + pruebas contractuales |
| R-006 | Exposición accidental de secretos | Baja | Crítico | Controlado | Guardas de build + variables server-only |
| R-007 | Falla de conectividad en automatización | Alta | Medio | Controlado | Outbox + reintentos + idempotencia |
| R-008 | Deuda de lint bloqueando release integral | Media | Medio | Abierto | Plan de saneamiento por módulos |
| R-009 | Crecimiento del indice documental local y degradacion de ranking | Media | Medio | Abierto | Limites de chunking/retencion, pruebas de ranking determinista y auditoria de relevancia |

## Riesgos sistémicos transversales

1. Dependencia operativa de múltiples superficies externas (Vercel, n8n, Neon, Evolution).
2. Doble realidad documental potencial (objetivo vs implementado) si no se actualiza governance.
3. Complejidad creciente por feature flags sin consolidación periódica.

## Señales tempranas de alerta

- incremento de incidentes de webhook timeout;
- aumento de retries de outbox sin cierre;
- discrepancias de estado de canal entre cliente y backend;
- fallas recurrentes en pruebas de integración.

## Plan de respuesta recomendado

1. Triage por criticidad e impacto en datos financieros.
2. Contención con fallback fail-closed.
3. Corrección con evidencia técnica.
4. Actualización documental y lecciones aprendidas.
