# Documentación de Private Balance

Este directorio contiene la documentación oficial del proyecto. La fuente canónica es [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md).

## Documento rector

- [`00_SYSTEM_ARCHITECTURE_MASTER.md`](00_SYSTEM_ARCHITECTURE_MASTER.md): mapa integral de producto, arquitectura, bounded contexts, dependencias, seguridad, calidad, deuda y roadmap. Debe leerse inmediatamente después de la Constitución.

## Mapa de documentos

- [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md) - Constitución técnica y fuente principal de verdad.
- [MCP_RULES.md](MCP_RULES.md) - Resumen operativo breve para agentes IA y MCP.
- [DECISIONS.md](DECISIONS.md) - ADRs del proyecto.
- [CHANGELOG.md](CHANGELOG.md) - Historial de cambios en formato Keep a Changelog.
- [00_PROJECT_VISION.md](00_PROJECT_VISION.md) - Visión, alcance y principios de producto.
- [01_ARCHITECTURE.md](01_ARCHITECTURE.md) - Arquitectura general y stack técnico.
- [02_BUSINESS_RULES.md](02_BUSINESS_RULES.md) - Reglas de negocio y modos Básico/Profesional.
- [03_DATABASE.md](03_DATABASE.md) - Persistencia local, Neon y resolución de canal.
- [04_N8N_WORKFLOWS.md](04_N8N_WORKFLOWS.md) - Inventario y riesgos de workflows n8n.
- [05_EVOLUTION_API.md](05_EVOLUTION_API.md) - Integración con Evolution API (proveedor `evolution`; ver también `whatsapp/` para el proveedor alternativo `meta-cloud`).
- [07_AI_ROADMAP.md](07_AI_ROADMAP.md) - Ruta futura de IA.
- [roadmap/PRODUCT_RELEASE_ROADMAP.md](roadmap/PRODUCT_RELEASE_ROADMAP.md) - Plan canónico de la Fase Pre-Release 0.9, sus sprints A-G, la RC y el lanzamiento 1.0.
- [architecture/20_DETERMINISTIC_FINANCIAL_COPILOT.md](architecture/20_DETERMINISTIC_FINANCIAL_COPILOT.md) - Arquitectura implementada del copiloto local, sus reglas, consultas, memoria y límites.
- [architecture/21_FREE_ASSISTANT_GUIDED_SANDBOX.md](architecture/21_FREE_ASSISTANT_GUIDED_SANDBOX.md) - Demostración local del Copiloto para licencias gratuitas, escenarios, privacidad y límites.
- [architecture/22_EXPLAINABLE_FINANCIAL_INTELLIGENCE.md](architecture/22_EXPLAINABLE_FINANCIAL_INTELLIGENCE.md) - Read models, evidencia y explicaciones deterministas de Iteración 5.
- [architecture/23_CONTEXTUAL_COPILOT_MEMORY.md](architecture/23_CONTEXTUAL_COPILOT_MEMORY.md) - Continuidad contextual efímera y limpieza manual.
- [product/financial-goals.md](product/financial-goals.md) - Entidad, progreso y ciclo de vida de objetivos financieros.
- [product/explainable-financial-health.md](product/explainable-financial-health.md) - Reglas públicas de salud financiera.
- [product/ITERATION_6_EXPERIENCE.md](product/ITERATION_6_EXPERIENCE.md) - Lenguaje, jerarquía y experiencia unificada de la Iteración 6.
- [product/PRE_RELEASE_0_9_SPRINT_A.md](product/PRE_RELEASE_0_9_SPRINT_A.md) - Auditoría, correcciones TDD, validaciones y estado de cierre del Sprint A.
- [product/PB_ONBOARDING_SEASON_PLANNING.md](product/PB_ONBOARDING_SEASON_PLANNING.md) - Implementación PB-001 a PB-003: onboarding, método de cálculo del ingreso y planificación de temporadas.
- [product/PB_004_CONVERSATION_AUDIT.md](product/PB_004_CONVERSATION_AUDIT.md) - Auditoría PB-004 de conversación, privacidad y robustez; sus hallazgos permanecen abiertos.
- [product/configurable-reports.md](product/configurable-reports.md) - Flujo configurable de reportes y formatos soportados.
- [architecture/24_LOCAL_DIAGNOSTICS.md](architecture/24_LOCAL_DIAGNOSTICS.md) - Diagnóstico local y exportación segura para soporte.
- [context/TECHNICAL_BACKLOG.md](context/TECHNICAL_BACKLOG.md) - Deuda técnica identificada y criterios de cierre.
- [08_DEPLOYMENT.md](08_DEPLOYMENT.md) - Despliegue y entornos.
- [AUTOMATION_HUB.md](AUTOMATION_HUB.md) - Contrato de automatización entre app, Vercel y n8n.
- [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md) - Documento técnico histórico y detallado.
- [LICENSE_DEVICE_REGISTRY.md](LICENSE_DEVICE_REGISTRY.md) - Registro y autorización de dispositivos por licencia.
- [MANUAL_USUARIO.md](MANUAL_USUARIO.md) - Guía de uso funcional.
- [WHATSAPP_E2E_CHECKLIST.md](WHATSAPP_E2E_CHECKLIST.md) - Checklist E2E histórico para licencia y canal WhatsApp vía Evolution API. Para el proveedor `meta-cloud`, usar [whatsapp/staging-test-plan.md](whatsapp/staging-test-plan.md).
- [security-test-checklist.md](security-test-checklist.md) - Checklist de pruebas de seguridad.
- [PRIVACY.md](PRIVACY.md) - Qué datos salen del dispositivo, hacia dónde y bajo qué condición.

### Integración WhatsApp Cloud API (`whatsapp/`)

Documentación de la migración de Evolution API a WhatsApp Cloud API de Meta (proveedor `meta-cloud`, seleccionable vía `WHATSAPP_PROVIDER`):

- [whatsapp/provider-abstraction.md](whatsapp/provider-abstraction.md) - Abstracción `WhatsAppProvider` compartida entre `evolution` y `meta-cloud`.
- [whatsapp/provider-routing.md](whatsapp/provider-routing.md) - Selección de proveedor activo y compatibilidad hacia atrás.
- [whatsapp/meta-cloud-environment.md](whatsapp/meta-cloud-environment.md) - Variables de entorno del backend meta-cloud.
- [whatsapp/meta-cloud-backend.md](whatsapp/meta-cloud-backend.md) - Servicios, repositorios y persistencia técnica.
- [whatsapp/meta-cloud-webhooks.md](whatsapp/meta-cloud-webhooks.md) - Contrato del webhook entrante, verificación de firma y normalización de payloads.
- [whatsapp/meta-cloud-security.md](whatsapp/meta-cloud-security.md) - Modelo de seguridad: firma HMAC, autenticación Bearer, rate limiting, redacción de logs.
- [whatsapp/meta-channel-persistence.md](whatsapp/meta-channel-persistence.md) - Persistencia del estado del canal por usuario/dispositivo.
- [whatsapp/meta-cloud-testing.md](whatsapp/meta-cloud-testing.md) - Estrategia de pruebas automatizadas.
- [whatsapp/staging-test-plan.md](whatsapp/staging-test-plan.md) - Plan de pruebas end-to-end en staging.
- [whatsapp/staging-validation-report.md](whatsapp/staging-validation-report.md) - Último reporte de validación (local vs. staging real).
- [whatsapp/n8n-meta-cloud-integration.md](whatsapp/n8n-meta-cloud-integration.md), [whatsapp/n8n-inbound-workflow.md](whatsapp/n8n-inbound-workflow.md), [whatsapp/n8n-status-workflow.md](whatsapp/n8n-status-workflow.md), [whatsapp/n8n-current-contracts.md](whatsapp/n8n-current-contracts.md) - Contratos y workflows n8n para el reenvío opcional de eventos (desactivado por defecto).
- [whatsapp/evolution-current-state.md](whatsapp/evolution-current-state.md) - Estado de Evolution API previo a la migración, como referencia de compatibilidad/rollback.

## Presentación y colaboración (raíz del repositorio)

- [../README.md](../README.md) - Presentación pública del proyecto.
- [../AGENTS.md](../AGENTS.md) - Guía práctica para agentes de IA y nuevos colaboradores.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) - Flujo de contribución.
- [../SECURITY.md](../SECURITY.md) - Reporte de vulnerabilidades.
- [../CHANGELOG.md](../CHANGELOG.md) - Puntero al changelog técnico detallado de esta carpeta.

## Reglas de uso

- Si un documento contradice la Constitución, prevalece la Constitución.
- Si una información no puede inferirse del código o de los workflows auditados, debe marcarse como pendiente de validar.
- Los documentos especializados complementan la Constitución; no la reemplazan.
