# ADR-010 — AI Interaction Platform antes de Conversation

**Estado:** Accepted  
**Fecha:** 2026-07-22

## Contexto

Construir Conversation directamente acoplaría la infraestructura inteligente al paradigma de chat y obligaría a modificar contratos al incorporar análisis, explicaciones, planificación, herramientas o automatizaciones.

## Decisión

Crear primero un dominio provider-neutral denominado AI Interaction Platform. Conversation será un tipo de consumidor construido sobre esta capa.

## Consecuencias

Se obtiene reutilización entre chat y operaciones no conversacionales, contratos más estables y separación entre intención de producto y proveedor. El coste es una capa adicional, limitada deliberadamente a contratos puros.
