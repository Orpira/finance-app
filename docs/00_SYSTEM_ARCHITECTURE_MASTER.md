# Private Balance — System Architecture Master

**Estado:** Activo  
**Versión:** 1.0  
**Última actualización:** 2026-07-21  
**Ámbito:** Producto, arquitectura, gobierno técnico y roadmap  
**Audiencia:** Desarrollo, arquitectura, QA, seguridad, operaciones y agentes de IA

---

## 1. Propósito del documento

Este documento es el mapa rector de Private Balance. Su función es permitir que una persona o agente técnico comprenda, con rapidez y sin depender de conversaciones previas:

- qué producto se está construyendo;
- qué principios no pueden violarse;
- cómo está organizado el sistema;
- cuáles son sus bounded contexts y dependencias;
- qué capacidades están implementadas y cuáles son objetivo;
- cómo se valida un cambio;
- qué riesgos y deudas permanecen abiertos;
- cuál es la siguiente secuencia de evolución.

Este documento **no sustituye** los contratos, ADRs ni documentos especializados. Los conecta y define su relación de autoridad.

### 1.1 Jerarquía documental

Ante contradicciones, se aplica el siguiente orden:

1. [`PRIVATE_BALANCE_CONSTITUTION.md`](PRIVATE_BALANCE_CONSTITUTION.md): principios normativos e invariantes no negociables.
2. [`DECISIONS.md`](DECISIONS.md) y futuros ADRs independientes: decisiones arquitectónicas aceptadas.
3. Este documento: mapa integral, arquitectura vigente, estado y roadmap.
4. Documentos especializados numerados y paquete `docs/architecture/`.
5. Documentos operativos de `docs/context/`.
6. Documentación auxiliar, manuales y material histórico.

Toda excepción a la Constitución o a un ADR aceptado requiere una nueva decisión explícita. Ningún cambio de código puede redefinir silenciosamente la arquitectura.

---

## 2. Resumen ejecutivo

Private Balance es una plataforma privada de finanzas personales y administración operativa para profesionales independientes y pequeños negocios. Se distribuye como aplicación web progresiva y aplicación Android mediante Capacitor.

Su propuesta central es combinar:

- control financiero local;
- funcionamiento offline;
- trazabilidad y reproducibilidad de cálculos;
- automatización remota opcional;
- mensajería contextual;
- inteligencia financiera determinista;
- capacidades de IA desacopladas y gobernadas por privacidad.

El núcleo financiero debe continuar funcionando aunque no exista conexión, proveedor cloud, canal de mensajería o modelo de IA. Las integraciones externas amplían capacidades; no poseen el dominio ni sustituyen la fuente local de verdad.

### 2.1 Resultado de producto esperado

Private Balance debe evolucionar como una plataforma capaz de ofrecer:

- registro de ingresos, egresos y ajustes;
- agenda, servicios y temporizadores;
- operación en modo Básico y Profesional;
- temporadas, cierres y reportes;
- exportación y respaldo;
- licenciamiento por dispositivo;
- automatización mediante eventos;
- canales de comunicación seguros;
- insights reproducibles;
- asistencia conversacional privada;
- sincronización multidispositivo cifrada y opcional.

### 2.2 Promesa arquitectónica

> Los datos financieros pertenecen al usuario; el dominio permanece local, determinista y reemplazable; toda frontera externa es explícita, autorizada y fail-closed.

---

## 3. Constitución resumida

Las reglas completas viven en [`PRIVATE_BALANCE_CONSTITUTION.md`](PRIVATE_BALANCE_CONSTITUTION.md). Este resumen no las reemplaza.

1. **Privacidad por diseño:** ningún dato financiero se comparte por defecto.
2. **Local-first:** la funcionalidad esencial reside en el dispositivo.
3. **Offline-first:** la red no es requisito para operar el núcleo.
4. **Propiedad del usuario:** el usuario controla almacenamiento, exportación, sincronización e integraciones.
5. **Dominio independiente:** frameworks, bases de datos y proveedores no gobiernan reglas de negocio.
6. **Contratos primero:** las capacidades se definen antes que sus implementaciones.
7. **Provider-neutral:** toda integración externa se encapsula en adaptadores.
8. **Fail-closed:** ante inconsistencia, se rechaza la operación sin inventar ni degradar garantías.
9. **Determinismo:** tiempo, azar y entorno se inyectan desde fronteras controladas.
10. **Compatibilidad controlada:** los contratos públicos evolucionan con migración explícita.
11. **Documentación como producto:** el cambio no termina mientras el estado documental sea inconsistente.
12. **Secretos fuera del cliente:** claves privadas y credenciales no pertenecen al frontend, APK ni repositorio.

---

## 4. Estado de arquitectura: implementado frente a objetivo

Private Balance distingue siempre entre arquitectura **implementada**, **parcial**, **planificada** y **exploratoria**. Los documentos no deben presentar una capacidad objetivo como si estuviera disponible.

| Capacidad | Estado | Fuente principal |
|---|---|---|
| Finanzas locales y UI principal | Implementada | `src/pages`, `src/services`, `src/database` |
| Dexie/IndexedDB y migraciones | Implementada | `src/database` |
| PWA + Android/Capacitor | Implementada | Vite/PWA, `android/` |
| Licencias y dispositivos | Implementada | `api/`, `server/` |
| Automatización n8n | Implementada con riesgos abiertos | gateway serverless + workflows externos |
| WhatsApp vía Evolution API | Implementada con riesgos operativos | n8n + backend contextual |
| Financial Snapshot | Implementada como derivado controlado | `src/intelligence/financial-snapshot` |
| Knowledge Layer | Implementada como derivado controlado | `src/intelligence/knowledge-layer` |
| Insight Engine + dashboard | Implementada | `src/insight`, `src/pages/Insights` |
| AI Privacy Boundary | Implementada | `src/intelligence/ai-foundation` |
| Authorized Context Builder | Implementada | `src/intelligence/ai-foundation` |
| LLM adapter contracts | Implementada | `src/intelligence/ai-foundation` |
| Provider capability registry | Implementada | `src/intelligence/ai-foundation` |
| Adapter compliance suite | Implementada | `src/intelligence/ai-foundation` |
| Mock LLM pipeline | Implementada | `src/intelligence/ai-foundation` |
| Conversation domain | Siguiente fase | Fase 9A |
| Conversation memory | Planificada | Fase 10 |
| Proveedor LLM real | No implementado | Futuro ADR + adaptador |
| Sincronización multidispositivo | Planificada | Fase posterior |
| Cifrado extremo a extremo para sync | Planificado | Precondición de sync |

---

## 5. Stack tecnológico oficial

El stack observable del repositorio es:

### Cliente

- React 19.
- TypeScript 6.
- Vite 8.
- React Router 7.
- Tailwind CSS 4.
- Zustand.
- React Hook Form + Zod.
- Dexie 4 + IndexedDB.
- Vite PWA.
- Capacitor 8 para Android.

### Backend ligero e integración

- Vercel Functions en `api/`.
- Utilidades server-side en `server/`.
- Neon Serverless PostgreSQL.
- n8n como orquestador externo.
- Evolution API como proveedor de WhatsApp.

### Calidad

- Vitest.
- ESLint.
- TypeScript project references.
- Pruebas IndexedDB en navegador real.

### Restricción de adopción tecnológica

Una dependencia nueva requiere justificar:

- problema que resuelve;
- por qué no puede resolverse con el stack actual;
- impacto en bundle, privacidad, mantenimiento y licencias;
- estrategia de sustitución;
- pruebas y documentación asociadas.

---

## 6. Vista general del sistema

```text
┌─────────────────────────────────────────────────────────────┐
│                     PRIVATE BALANCE                         │
├─────────────────────────────────────────────────────────────┤
│ UI / Presentation                                           │
│ React pages · components · routing · guards                 │
├─────────────────────────────────────────────────────────────┤
│ Application Services                                        │
│ use cases · orchestration · feature flags · adapters        │
├─────────────────────────────────────────────────────────────┤
│ Domain & Intelligence                                       │
│ finance rules · snapshots · knowledge · insights · AI      │
├─────────────────────────────────────────────────────────────┤
│ Local Infrastructure                                        │
│ Dexie · IndexedDB · export/import · outbox                  │
├─────────────────────────────────────────────────────────────┤
│ Controlled External Boundary                                │
│ Vercel Functions → n8n → Neon / Evolution API              │
└─────────────────────────────────────────────────────────────┘
```

### 6.1 Flujo local principal

```text
User Interaction
      ↓
React Page / Form
      ↓
Application Service
      ↓
Validated Domain Operation
      ↓
Dexie Transaction
      ↓
Read Model / UI Refresh
      ↓
Optional Outbox Event
```

### 6.2 Flujo externo controlado

```text
Local Outbox Event
      ↓
/api/automation-token
      ↓
Short-lived Authorization
      ↓
/api/automation
      ↓
n8n Workflow
      ├── Neon
      └── Evolution API → WhatsApp
```

Ningún servicio externo debe convertirse en requisito para registrar o consultar la información financiera esencial.

### 6.3 Pipeline de inteligencia implementado

```text
Legacy Financial Source
      ↓
Financial Engine Adapter
      ↓
Financial Snapshot
      ↓
Knowledge Layer
      ↓
Insight Runtime
      ↓
Insight Read Models
      ↓
Insights Dashboard
```

### 6.4 Pipeline de AI Foundation implementado

```text
Authorized Financial/Insight Input
      ↓
AI Privacy Boundary
      ↓
Authorized Context Builder
      ↓
LLM Adapter Contracts
      ↓
Capability Registry
      ↓
Compliance Suite
      ↓
Mock LLM Adapter
      ↓
Deterministic Validation Result
```

La implementación actual prueba la arquitectura sin proveedor real, red ni persistencia conversacional.

---

## 7. Capas y reglas de dependencia

### 7.1 Presentation

**Ubicación:** `src/app`, `src/routes`, `src/pages`, `src/components`, `src/hooks`.

Puede depender de:

- servicios de aplicación;
- tipos públicos;
- selectores/read models;
- utilidades de presentación.

No debe:

- ejecutar SQL o manipular tablas directamente;
- contener secretos;
- implementar reglas financieras canónicas;
- conocer detalles de proveedores externos;
- invocar Evolution o Neon directamente.

### 7.2 Application

**Ubicación principal:** `src/services` y orquestadores de subsistemas.

Responsabilidades:

- coordinar casos de uso;
- validar precondiciones de frontera;
- iniciar transacciones;
- aplicar feature flags;
- transformar modelos de dominio en read models;
- invocar puertos.

No debe:

- ocultar errores críticos;
- crear dependencias inversas desde el dominio hacia UI o infraestructura;
- duplicar reglas de negocio en múltiples servicios.

### 7.3 Domain / Intelligence

**Ubicación:** `src/types`, utilidades puras seleccionadas, `src/intelligence`, `src/insight`.

Responsabilidades:

- contratos y value objects;
- invariantes financieros;
- snapshot y conocimiento derivados;
- reglas de insights;
- políticas de privacidad IA;
- contratos provider-neutral.

No debe depender de:

- React;
- Dexie concreto cuando exista un puerto disponible;
- HTTP;
- SDKs de proveedores;
- relojes o generadores aleatorios globales;
- variables de entorno leídas de forma implícita.

### 7.4 Infrastructure

**Ubicación:** `src/database`, adaptadores concretos en `src/services`, `api`, `server`.

Responsabilidades:

- persistencia;
- transporte;
- criptografía operativa;
- integración con servicios externos;
- serialización y migraciones.

Debe implementar contratos definidos por capas internas y traducir errores externos a fallos tipados.

### 7.5 Regla de dirección

```text
Presentation → Application → Domain
                         ↑
                Infrastructure adapters
```

El dominio no importa Presentation ni Infrastructure. Una excepción requiere ADR.

---

## 8. Bounded contexts

### 8.1 Financial Ledger

**Responsabilidad:** registrar la realidad financiera operativa.

Incluye:

- ingresos;
- egresos;
- ajustes;
- monedas y conversiones;
- categorías;
- balances;
- trazabilidad histórica.

**Fuente de verdad actual:** almacenamiento local legacy controlado.

**Invariantes:**

- no alterar balances históricos sin migración explícita;
- ajustes conservan su clasificación;
- exportaciones no mutan datos;
- cálculos deben ser reproducibles.

### 8.2 Operating Modes & Seasons

**Responsabilidad:** separar reglas de modo Básico y Profesional.

- Básico no depende de temporadas.
- Profesional puede exigir temporada activa y reglas de cierre.
- Cambiar de modo no debe mezclar ni corromper datos.

### 8.3 Agenda & Services

**Responsabilidad:** gestionar citas, servicios, duración y temporizadores.

Los temporizadores aportan evidencia operativa; no modifican balances sin un caso de uso financiero explícito.

### 8.4 Reporting & Export

**Responsabilidad:** producir vistas y documentos derivados de datos persistidos.

No puede convertirse en una fuente alternativa de cálculo ni alterar el libro.

### 8.5 Local Persistence

**Responsabilidad:** asegurar persistencia transaccional, migraciones y funcionamiento offline.

- Dexie/IndexedDB es infraestructura local principal.
- Migraciones deben ser incrementales y probadas.
- Import/export requiere validación antes de reemplazar datos.
- Snapshots de inteligencia no sustituyen tablas operativas.

### 8.6 Licensing & Device Registry

**Responsabilidad:** validar licencias, autorizar dispositivos y limitar acceso a servicios protegidos.

- El cliente puede transportar evidencia, no claves privadas.
- La firma/verificación sensible se mantiene server-side.
- La licencia no debe bloquear acceso ilegítimamente a datos ya propiedad del usuario sin una política explícita.

### 8.7 Automation & Event Outbox

**Responsabilidad:** publicar eventos opcionales y trazables hacia automatizaciones externas.

- Entrega idempotente.
- Reintentos controlados.
- Ningún fallo remoto revierte silenciosamente una operación local ya confirmada.
- n8n orquesta, pero no redefine reglas financieras.

### 8.8 Communication Channels

**Responsabilidad:** resolver canales activos por contexto de usuario/dispositivo.

Resolución normativa:

```text
deviceCode → userCode → communication_channels
```

Está prohibida la selección global por simple recencia sin filtro contextual.

### 8.9 Financial Snapshot

**Responsabilidad:** construir una representación financiera derivada, inmutable y reproducible para consumidores de inteligencia.

- No sustituye al libro.
- No escribe operaciones financieras.
- Debe registrar versión y evidencia de origen.

### 8.10 Knowledge Layer

**Responsabilidad:** transformar snapshots autorizados en conocimiento estructurado y versionado.

- Append-only según diseño vigente.
- No accede a UI ni a proveedores IA.
- Debe mantener trazabilidad hasta sus fuentes.

### 8.11 Insight Engine

**Responsabilidad:** ejecutar reglas deterministas y producir insights auditables.

Incluye:

- catálogo de reglas;
- builder y validator;
- runtime;
- repositorio/read models;
- dashboard de Insights.

Los insights son recomendaciones explicables, no operaciones automáticas.

### 8.12 AI Foundation

**Responsabilidad:** permitir futura integración con modelos sin exponer dominio, secretos ni contexto no autorizado.

Incluye hitos 8A–8F:

- privacy boundary;
- authorized context builder;
- contratos LLM;
- capability registry;
- compliance suite;
- mock adapter y validación E2E.

### 8.13 Conversation — objetivo siguiente

**Estado:** no implementado.

La Fase 9 debe introducir contratos de sesión, mensajes, estados, roles, visibilidad y políticas sin añadir aún UI, persistencia o proveedor real.

### 8.14 Synchronization — objetivo futuro

**Estado:** planificado.

Debe preservar:

- operación offline;
- cifrado de extremo a extremo;
- independencia de proveedor;
- resolución determinista de conflictos;
- auditoría local;
- consentimiento granular del usuario.

Ninguna sincronización debe comenzar antes de definir modelo de identidad, claves, versiones, conflictos y recuperación.

---

## 9. Matriz de dependencias permitidas

Leyenda: **Sí** = dependencia permitida; **Puerto** = solo mediante contrato; **No** = prohibida.

| Consumidor ↓ / Proveedor → | Ledger | Persistence | Snapshot | Knowledge | Insights | AI | Automation | Communication |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| UI | Puerto | No directo | Read model | Read model | Read model | Puerto futuro | Puerto | Puerto |
| Application Services | Sí | Puerto | Puerto | Puerto | Puerto | Puerto | Puerto | Puerto |
| Ledger Domain | — | No | No | No | No | No | No | No |
| Snapshot | Contrato de lectura | Puerto | — | No | No | No | No | No |
| Knowledge | No directo | Puerto | Sí | — | No | No | No | No |
| Insights | No directo | Puerto | Sí | Sí | — | No | No | No |
| AI Foundation | No directo | No | Solo contexto autorizado | Solo contexto autorizado | Solo contexto autorizado | — | No | No |
| Automation | Eventos DTO | Puerto local | No | No | No | No | — | Puerto |

Una importación que contradiga esta matriz debe corregirse o documentarse mediante ADR.

---

## 10. Contratos e invariantes transversales

### 10.1 Contratos

Todo contrato público nuevo debe ser:

- explícito y tipado;
- readonly cuando represente datos de entrada o resultado;
- JSON-safe si cruza persistencia, worker, red o proveedor;
- versionable;
- independiente del transporte;
- acompañado de pruebas de éxito y fallo.

### 10.2 Errores

Las fronteras críticas usan fallos discriminados y códigos cerrados. No se debe depender de mensajes libres para tomar decisiones de negocio.

### 10.3 Tiempo e identidad

Dentro del dominio está prohibido obtener implícitamente:

- hora actual;
- UUID;
- aleatoriedad;
- locale o zona horaria del entorno.

Estos valores se reciben mediante parámetros o puertos y quedan disponibles para pruebas reproducibles.

### 10.4 Mutabilidad

- Los registros financieros históricos no se reescriben sin regla explícita.
- Snapshots y knowledge deben conservar su política append-only.
- Los read models pueden regenerarse; la evidencia fuente no.

### 10.5 Feature flags

- Deben ser exactos, documentados y fail-closed.
- Ausencia o valor inválido mantiene el comportamiento estable.
- No se permiten toggles ocultos o overrides programáticos no documentados.

---

## 11. Seguridad y privacidad

### 11.1 Clasificación de datos

| Clase | Ejemplos | Tratamiento |
|---|---|---|
| Financiero sensible | ingresos, egresos, balances | local por defecto; mínima exposición |
| Identidad/Dispositivo | userCode, deviceCode | acceso restringido y trazable |
| Credenciales | claves privadas, API keys, tokens | nunca en cliente ni repositorio |
| Contexto IA autorizado | fragmentos filtrados | mínimo necesario, con política explícita |
| Telemetría técnica | errores, métricas | sin datos financieros salvo consentimiento |

### 11.2 Secretos

La presencia de `license-private-key.json` en un snapshot constituye un riesgo que debe resolverse en el repositorio operativo:

1. confirmar que no esté versionado;
2. añadir exclusión explícita;
3. mover el secreto a almacenamiento seguro server-side;
4. rotarlo si pudo ser expuesto;
5. verificar que no se incluya en builds, APKs, backups o entregables.

No se debe copiar, mostrar ni reutilizar su contenido durante tareas de documentación.

### 11.3 Frontera IA

Un proveedor IA nunca recibe:

- base de datos completa;
- claves o tokens;
- snapshots completos sin autorización;
- conocimiento completo;
- datos no requeridos para la solicitud;
- acceso directo a repositorios.

### 11.4 Seguridad de integraciones

- CORS y content-type defensivos.
- Límites de tamaño de payload.
- JWT de corta duración para automatización.
- Validación Zod en fronteras.
- Consultas SQL parametrizadas.
- Resolución contextual de canales.
- Respuesta explícita en todos los webhooks críticos.

---

## 12. Persistencia, migraciones y respaldo

### 12.1 Local

Dexie/IndexedDB conserva la operación principal. Toda nueva versión debe:

- incrementar versión de esquema cuando corresponda;
- preservar datos existentes;
- definir migración transaccional;
- incluir pruebas de upgrade;
- considerar import/export;
- documentar rollback o recuperación.

### 12.2 Remota

Neon se limita actualmente a licencias, dispositivos, canales e infraestructura de automatización. No es la fuente canónica del libro financiero local.

### 12.3 Retención

Permanece abierta la definición formal de retención para snapshots y knowledge. Antes de aumentar su volumen se debe establecer:

- límites por cantidad o antigüedad;
- reglas de compactación;
- preservación de evidencia;
- comportamiento en export/import;
- impacto en almacenamiento móvil.

---

## 13. Automatización y mensajería

### 13.1 Reglas n8n

- Todo webhook termina en `Respond to Webhook`.
- No existen ramas críticas sin respuesta.
- Los errores devuelven JSON válido.
- La idempotencia se registra con identificador de evento.
- Las credenciales permanecen en n8n o backend seguro.
- Los workflows no calculan el balance canónico.

### 13.2 Riesgos vigentes

- Flujo `Private Balance - Nuevo Ingreso` con ramas históricamente incompletas.
- Referencias legacy coexistiendo con `communication_channels` y `license_devices`.
- Cobertura automatizada de contratos n8n aún incompleta.

Estos riesgos no se consideran cerrados hasta disponer de evidencia sobre los workflows reales desplegados.

---

## 14. Estrategia de inteligencia artificial

### 14.1 Principio

La IA es un consumidor autorizado de contexto, no una autoridad financiera ni un actor con acceso directo a datos.

### 14.2 Secuencia de evolución

```text
Deterministic Insights
      ↓
AI Privacy Boundary
      ↓
Authorized Context
      ↓
Provider-neutral Contracts
      ↓
Conversation Domain
      ↓
Ephemeral Conversation Runtime
      ↓
Optional Local Memory
      ↓
Optional Real Provider Adapters
```

### 14.3 Proveedores reales

No se integrará OpenAI, Anthropic, Gemini, Ollama u otro proveedor antes de contar con:

- conversación tipada;
- política de consentimiento;
- capability matching;
- compliance suite aprobada;
- redaction y límites de contexto;
- logging seguro sin contenido sensible;
- timeout, cancelación y error normalization;
- ADR de adopción y estrategia de sustitución.

### 14.4 Memoria

La memoria conversacional futura debe ser:

- opcional;
- local por defecto;
- visible y borrable por el usuario;
- separada del libro financiero;
- limitada por política de retención;
- libre de secretos y datos no autorizados.

---

## 15. Estrategia de sincronización multidispositivo

La sincronización es una capacidad futura, no una migración a online-first.

### 15.1 Requisitos previos

- identidad estable por usuario y dispositivo;
- claves de cifrado gestionadas por el usuario;
- versionado de entidades;
- registro de cambios local;
- estrategia de conflictos por tipo de dato;
- protocolo de recuperación y nuevo dispositivo;
- eliminación remota verificable;
- pruebas de desconexión y concurrencia.

### 15.2 Modelo objetivo

```text
Device A Local DB ─┐
                   ├─ Encrypted Change Transport ─ User-owned Sync Space
Device B Local DB ─┘
```

El servidor de sincronización debería transportar ciphertext y metadatos mínimos. No debería poder interpretar balances ni movimientos.

### 15.3 Conflictos

No se adoptará una regla universal de “last write wins” para datos financieros. Cada agregado debe definir su semántica:

- creación concurrente;
- edición concurrente;
- eliminación;
- cierre de temporada;
- reconciliación de ajustes;
- eventos append-only.

---

## 16. Convenciones de implementación

### 16.1 Organización

- Una responsabilidad principal por módulo.
- Nombres de archivo y símbolos alineados con el lenguaje del dominio.
- Barrel exports solo cuando no oculten ciclos ni dependencias.
- Evitar módulos genéricos `helpers` o `utils` sin contexto.

### 16.2 TypeScript

- Evitar `any`; usar `unknown` y refinamiento.
- Discriminated unions para resultados y fallos.
- Objetos de contrato readonly.
- Exhaustividad con `never` cuando aplique.
- Sin casts para silenciar diseños incompletos.

### 16.3 React

- Componentes sin reglas financieras canónicas.
- Efectos reservados para sincronización con sistemas externos a React.
- No usar efectos para derivar estado que puede calcularse durante render.
- Hooks con dependencia completa y comportamiento cancelable cuando haya asincronía.

### 16.4 Persistencia

- Operaciones relacionadas en una transacción.
- Repositorios/adaptadores cuando el dominio no deba conocer Dexie.
- Migraciones probadas sobre versiones anteriores representativas.

### 16.5 Documentación

Cada milestone debe actualizar:

- documento especializado;
- estado actual si cambia una capacidad;
- ADR cuando introduce decisión estructural;
- este master cuando cambia arquitectura, estado o roadmap.

---

## 17. Estrategia de pruebas

### 17.1 Pirámide práctica

1. **Unitarias:** invariantes, validadores, builders, reglas y serializers.
2. **Contratos:** puertos, adapters, discriminated unions, JSON-safety.
3. **Integración local:** servicios + Dexie + migraciones.
4. **Browser-real:** IndexedDB/PWA cuando el entorno simulado no es suficiente.
5. **API/server:** validación, seguridad, SQL y dispatch.
6. **E2E selectivo:** flujos de usuario y automatización crítica.

### 17.2 Casos mínimos por módulo

- camino exitoso;
- entrada inválida;
- dependencia fallida;
- ausencia de autorización;
- serialización/deserialización;
- determinismo;
- rollback o fail-closed;
- ausencia de efectos prohibidos.

### 17.3 Arquitectura verificable

Se recomienda evolucionar hacia tests estáticos que detecten:

- imports prohibidos entre capas;
- uso de `Date.now`, `Math.random` o `randomUUID` en dominio;
- acceso directo a proveedores desde UI;
- secretos o patrones de claves;
- documentos huérfanos;
- contratos sin pruebas.

---

## 18. Gates de calidad y release

Antes de certificar un milestone:

```bash
npm test
npm run build
npm run lint
git diff --check
```

Cuando el cambio afecte persistencia:

```bash
npm run test:indexeddb
```

### 18.1 Política de certificación

Un milestone solo se certifica con evidencia verificable:

- lista exacta de archivos creados/modificados;
- explicación de decisiones;
- pruebas añadidas y resultados;
- resultado de gates;
- escaneos estáticos relevantes;
- deuda o limitaciones explícitas.

Un texto que solo declare “listo” no es evidencia suficiente.

### 18.2 Deuda de lint

El snapshot actual documenta deuda global de lint en áreas históricas. Debe cerrarse como trabajo de baseline sin relajar reglas ni ocultar errores. Mientras exista:

- el release global permanece bloqueado;
- un milestone puede recibir certificación técnica de alcance solo con lint específico verde y evidencia de que no introduce nueva deuda;
- la excepción debe quedar registrada.

### 18.3 Secret scanning

Todo release debe verificar que no se incluyan:

- archivos `*private-key*`;
- `.env` no ejemplares;
- tokens JWT persistentes;
- API keys;
- credenciales de Neon, n8n o Evolution;
- certificados o keystores no destinados a distribución pública.

---

## 19. Decisiones arquitectónicas vigentes

Resumen; la autoridad completa está en [`DECISIONS.md`](DECISIONS.md).

| ADR | Decisión | Estado |
|---|---|---|
| ADR-001 | Neon como backend principal de licencias/dispositivos/canales | Accepted |
| ADR-002 | n8n como motor de automatización | Accepted |
| ADR-003 | Evolution API como proveedor WhatsApp encapsulado | Accepted |
| ADR-004 | MCP para auditoría/desarrollo, no runtime | Accepted |
| ADR-005 | Resolución contextual de canal obligatoria | Accepted |
| ADR-006 | Constitución como fuente normativa | Accepted |
| ADR-007 | Índice documental explícito | Accepted |
| ADR-008 | Adopción controlada del Financial Engine | Accepted |
| ADR-009 | System Architecture Master como mapa rector | Accepted |

### 19.1 ADRs futuras recomendadas

- estrategia formal de certificación de milestones;
- política de retención de snapshots/knowledge;
- arquitectura de conversación;
- memoria local y borrado;
- selección de primer proveedor LLM real;
- sincronización E2E;
- política de licencias y acceso a datos locales;
- estrategia de telemetría privacy-preserving.

---

## 20. Deuda técnica priorizada

| ID | Área | Prioridad | Estado | Acción requerida |
|---|---|---:|---|---|
| TD-001 | Lint global | P1 | Abierta | Corregir sin relajar reglas |
| TD-002 | Secret handling | P0 | Abierta | Retirar/rotar clave privada y asegurar exclusiones |
| TD-003 | n8n ramas sin respuesta | P0 | Abierta | Auditar workflows desplegados y corregir |
| TD-004 | Consultas/canales legacy | P1 | Abierta | Converger a modelo contextual moderno |
| TD-005 | Retención snapshots/knowledge | P2 | Abierta | Definir política y tests |
| TD-006 | CI/CD con gates | P1 | Planificada | Automatizar test/build/lint/secret scan |
| TD-007 | Bundle principal >500 kB | P2 | Observada | Analizar code splitting y carga diferida |
| TD-008 | Context docs desactualizados | P1 | En corrección | Mantener estado y siguiente tarea alineados |

La prioridad P0 representa riesgo de seguridad o integridad que debe atenderse antes de ampliar exposición del sistema.

---

## 21. Riesgos arquitectónicos

### 21.1 Deriva documental

**Riesgo:** documentos históricos describen fases anteriores como estado actual.  
**Mitigación:** este master + actualización obligatoria del paquete `context` por milestone.

### 21.2 Doble fuente financiera

**Riesgo:** consumidores mezclan legacy y Financial Engine.  
**Mitigación:** flags exactos, shadow/promotion, ADR de corte antes de cambiar autoridad.

### 21.3 Exposición de secretos

**Riesgo:** claves privadas en snapshots, repositorio o builds.  
**Mitigación:** rotación, secret scanning, almacenamiento server-side y exclusiones.

### 21.4 Dependencia operacional de n8n

**Riesgo:** ramas incompletas, workflows legacy o indisponibilidad.  
**Mitigación:** outbox, idempotencia, respuestas explícitas, contratos y degradación local.

### 21.5 Crecimiento de IndexedDB

**Riesgo:** snapshots append-only y adjuntos aumentan almacenamiento.  
**Mitigación:** política de retención, métricas locales, compactación segura y exportación.

### 21.6 IA con contexto excesivo

**Riesgo:** adapters futuros reciben más datos de los autorizados.  
**Mitigación:** privacy boundary obligatorio, fixtures adversariales y compliance suite.

### 21.7 Sincronización prematura

**Riesgo:** corrupción o conflictos irreversibles al sincronizar registros financieros.  
**Mitigación:** diseñar identidad, versionado, cifrado y conflictos antes de transporte.

---

## 22. Roadmap arquitectónico

### Fases consolidadas

| Fase | Capacidad | Estado |
|---|---|---|
| 1–6 | Core financiero, persistencia, UI e integraciones base | Implementado |
| 7A–7F | Engine integration e Insight Dashboard | Implementado |
| 8A | AI Privacy Boundary | Implementado |
| 8B | Authorized Context Builder | Implementado |
| 8C | LLM Adapter Contracts | Implementado; release global condicionado por lint |
| 8D | Provider Capability Registry | Implementado |
| 8E | Provider Compliance Suite | Implementado |
| 8F | Mock LLM E2E Pipeline | Implementado |

### Fase 9 — Conversation Layer

**9A — Conversation Domain & Session Contracts**

- IDs, estados, mensajes, roles y visibilidad.
- Políticas de sesión.
- Resultados y fallos discriminados.
- Sin UI, persistencia, prompts, red o proveedor real.

**9B — Conversation Lifecycle Service**

- creación, activación, suspensión, cierre y archivo;
- reloj e IDs inyectados;
- invariantes de transición.

**9C — Turn Orchestration**

- preparación de turno;
- contexto autorizado;
- invocación por puerto;
- normalización de respuesta;
- cancelación y timeout como contratos.

**9D — Ephemeral Conversation Runtime**

- almacenamiento solo en memoria;
- límites de tamaño;
- borrado explícito;
- sin persistencia todavía.

**9E — Conversation Read Models**

- vistas seguras para UI;
- separación entre contenido visible, interno y auditoría.

**9F — Conversation UI Pilot**

- interfaz local sobre mock adapter;
- accesibilidad;
- estados de carga/error;
- sin proveedor real.

### Fase 10 — Memory & Retention

- memoria opt-in;
- almacenamiento local cifrable;
- retención y borrado;
- resumen determinista;
- exportación selectiva.

### Fase 11 — Provider Adapters

- primer adaptador real bajo ADR;
- consentimiento y configuración;
- redaction;
- observabilidad segura;
- fallback y portability.

### Fase 12 — Secure Multi-device Sync

- change log;
- cifrado E2E;
- sincronización incremental;
- conflicto por agregado;
- recuperación de dispositivo.

### Fase 13 — Product Hardening

- CI/CD completo;
- performance budgets;
- accesibilidad;
- release channels;
- observabilidad privacy-preserving;
- preparación de tiendas.

---

## 23. Secuencia inmediata aprobada

Antes de ampliar el sistema con un proveedor real o sincronización:

1. Corregir y validar el gate global de lint.
2. Resolver manejo del archivo de clave privada y establecer secret scanning.
3. Sincronizar documentación de contexto con el estado 8F.
4. Implementar **9A — AI Conversation Domain & Session Contracts**.
5. Certificar 9A con tests, build, lint y diff check.
6. Continuar 9B–9F manteniendo mock adapter como única implementación.

La corrección de riesgos P0 puede interrumpir esta secuencia cuando exista evidencia de exposición o fallo operativo.

---

## 24. Definition of Done arquitectónica

Un cambio significativo está terminado únicamente cuando:

- satisface el caso de uso;
- mantiene invariantes;
- respeta dependencias permitidas;
- implementa fallos tipados y fail-closed;
- añade pruebas suficientes;
- pasa los gates aplicables;
- no introduce secretos;
- actualiza documentación y ADRs necesarios;
- incluye plan de migración si cambia datos o contratos;
- puede revertirse o degradar de forma segura.

---

## 25. Guía de incorporación para humanos y agentes IA

Orden mínimo de lectura:

1. [`PRIVATE_BALANCE_CONSTITUTION.md`](PRIVATE_BALANCE_CONSTITUTION.md)
2. Este documento.
3. [`DECISIONS.md`](DECISIONS.md)
4. [`context/CURRENT_STATE.md`](context/CURRENT_STATE.md)
5. [`context/NEXT_TASK.md`](context/NEXT_TASK.md)
6. Documento especializado del módulo a modificar.
7. Código y pruebas del módulo.

Antes de editar:

- identificar la fuente de verdad;
- listar archivos afectados;
- verificar dependencias;
- comprobar si se requiere ADR o migración;
- ejecutar baseline de tests/build/lint;
- no asumir que un documento histórico refleja el código actual.

Después de editar:

- ejecutar gates;
- reportar resultados exactos;
- documentar limitaciones;
- no hacer commit hasta aprobación cuando el flujo de trabajo lo exija.

---

## 26. Índice de documentación especializada

### Fundamentos

- [`00_PROJECT_VISION.md`](00_PROJECT_VISION.md)
- [`01_ARCHITECTURE.md`](01_ARCHITECTURE.md)
- [`02_BUSINESS_RULES.md`](02_BUSINESS_RULES.md)
- [`03_DATABASE.md`](03_DATABASE.md)
- [`DECISIONS.md`](DECISIONS.md)

### Integraciones y operación

- [`04_N8N_WORKFLOWS.md`](04_N8N_WORKFLOWS.md)
- [`05_EVOLUTION_API.md`](05_EVOLUTION_API.md)
- [`08_DEPLOYMENT.md`](08_DEPLOYMENT.md)
- [`AUTOMATION_HUB.md`](AUTOMATION_HUB.md)
- [`LICENSE_DEVICE_REGISTRY.md`](LICENSE_DEVICE_REGISTRY.md)

### Intelligence & AI

- [`09_AI_CORE_ARCHITECTURE.md`](09_AI_CORE_ARCHITECTURE.md)
- [`10_FINANCIAL_SNAPSHOT_ARCHITECTURE.md`](10_FINANCIAL_SNAPSHOT_ARCHITECTURE.md)
- [`11_FINANCIAL_SNAPSHOT_INVARIANTS.md`](11_FINANCIAL_SNAPSHOT_INVARIANTS.md)
- [`12_FINANCIAL_SNAPSHOT_NORMATIVE_DECISIONS.md`](12_FINANCIAL_SNAPSHOT_NORMATIVE_DECISIONS.md)
- [`13_KNOWLEDGE_LAYER_ARCHITECTURE.md`](13_KNOWLEDGE_LAYER_ARCHITECTURE.md)
- [`15_INSIGHT_RULE_MODEL.md`](15_INSIGHT_RULE_MODEL.md) a [`25_INSIGHT_DASHBOARD_INTEGRATION.md`](25_INSIGHT_DASHBOARD_INTEGRATION.md)
- [`26_AI_FOUNDATION_PRIVACY_BOUNDARY.md`](26_AI_FOUNDATION_PRIVACY_BOUNDARY.md) a [`31_MOCK_LLM_PIPELINE.md`](31_MOCK_LLM_PIPELINE.md)

### Arquitectura detallada

- [`architecture/`](architecture/)

### Estado operativo

- [`context/CURRENT_STATE.md`](context/CURRENT_STATE.md)
- [`context/NEXT_TASK.md`](context/NEXT_TASK.md)
- [`context/KNOWN_ISSUES.md`](context/KNOWN_ISSUES.md)
- [`context/ROADMAP.md`](context/ROADMAP.md)
- [`context/RISKS.md`](context/RISKS.md)
- [`context/TODO.md`](context/TODO.md)

---

## 27. Mantenimiento de este documento

Actualizar este master cuando ocurra cualquiera de estos eventos:

- se crea o elimina un bounded context;
- cambia una fuente de verdad;
- se adopta un proveedor o framework relevante;
- se modifica la dirección de dependencias;
- se completa una fase del roadmap;
- se acepta una ADR estructural;
- aparece o se cierra un riesgo P0/P1;
- cambia un gate de release;
- se introduce persistencia, sincronización o transmisión de datos nueva.

Cada actualización debe preservar la distinción entre **implementado** y **objetivo**.

---

## 28. Veredicto de arquitectura actual

Private Balance dispone de una base local-first sólida, un sistema financiero operativo y una cadena de inteligencia determinista que culmina en una AI Foundation provider-neutral validada con un mock adapter.

La arquitectura está preparada para iniciar la capa conversacional, pero antes de ampliar exposición debe cerrar dos asuntos prioritarios:

- deuda global de lint como gate de release;
- manejo seguro de la clave privada detectada en el snapshot.

El siguiente milestone funcional correcto continúa siendo **9A — AI Conversation Domain & Session Contracts**, manteniendo ausencia de UI, red, persistencia y proveedor real.
