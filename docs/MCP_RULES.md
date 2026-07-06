# MCP_RULES.md — Resumen operativo para agentes

Este archivo es solo un resumen operativo. La fuente canónica es [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md).

## Reglas mínimas

- Leer la Constitución antes de proponer cambios.
- No modificar producción sin autorización explícita.
- No tocar cálculos financieros, balances históricos ni reglas de temporadas sin una ADR nueva.
- No usar Supabase como referencia principal.
- No usar MCP como runtime de producción.
- No enviar WhatsApp usando canales globales.
- No usar ORDER BY updated_at DESC LIMIT 1 sin filtro por user_code o device_code.
- Todo webhook n8n debe terminar en Respond to Webhook.
- No hardcodear API keys en workflows.

## Resolución de canales

La ruta oficial es:

Evento -> deviceCode -> license_devices -> user_code -> communication_channels

## Alcance

- Agentes IA y MCP deben leer primero la Constitución antes de proponer cambios.
- Si hay contradicción, la Constitución prevalece.
- Este archivo no sustituye documentación especializada ni ADRs.

## Prioridad documental

1. [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md)
2. [DECISIONS.md](DECISIONS.md)
3. Este archivo como resumen operativo.

## Estado de documentos auxiliares

- 06_MCP_RULES.md quedó obsoleto y fue eliminado.
