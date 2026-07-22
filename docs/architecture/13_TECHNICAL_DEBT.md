# 13 - Technical Debt

## 1) Resumen ejecutivo

La base funcional está sólida en invariantes críticos, pero hay deuda concentrada en integración operativa de workflows, consolidación de legacy y gobernanza de release.

## 2) Deuda priorizada

### P0 - Crítica para robustez operativa

1. Ramas sin respuesta final en workflow `Private Balance - Nuevo Ingreso`.
Impacto: timeout/reintentos ambiguos, degradación de trazabilidad.

2. Restos de referencias legacy (`app_user`, `device`, `whatsapp_channel`) en workflows históricos.
Impacto: divergencia entre arquitectura actual y ejecución real.

3. Definición formal ausente de criterio técnico "8A" en documentación canónica.
Impacto: ambigüedad de certificación futura.

### P1 - Alta

4. Política de retención de snapshots/knowledge no formalizada.
Impacto: crecimiento de IndexedDB y presión de almacenamiento.

5. Hardening insuficiente automatizado para lint de workflows n8n.
Impacto: riesgo de regresión no detectada en cambios de flujo.

6. Deuda de lint global en módulos fuera de alcance de hitos recientes.
Impacto: fricción en gates de calidad de release.

### P2 - Media

7. Falta de CI/CD documentado con gates técnicos obligatorios.
8. Métricas observables sin tablero consolidado de salud técnica.
9. Dependencia de validaciones manuales para parte de operación n8n.

## 3) Deuda por área

### Arquitectura

- coexistencia de capas objetivo vs implementadas en AI Core.
- transición gradual aún incompleta de legacy a contratos más rígidos.

### Datos

- necesidad de estrategia de archivado no destructiva para append-only.

### Seguridad

- formalizar rotación y auditoría de secretos periódica.

### Testing

- ampliar pruebas contractuales de workflows y API edge cases.

## 4) Plan de reducción sugerido

1. Cerrar P0 de workflows y definición 8A.
2. Ejecutar convergencia de tablas legacy en flujos remotos.
3. Implementar runbook de retención de snapshots.
4. Establecer pipeline CI con gates mínimos (build, test, indexeddb, lint-scope).

## 5) Criterios de salida de deuda

Una deuda se considera cerrada solo cuando:

- existe cambio implementado y validado;
- hay evidencia en pruebas/comandos;
- se actualiza documentación (`CHANGELOG`, `DECISIONS` o doc técnica específica).
