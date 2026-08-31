# ADR-034 — Notificaciones proactivas del Copiloto

**Estado:** Aceptado — Fase 1 implementada el 30/08/2026 (`src/notifications/`)
**Proyecto:** Private Balance
**Área:** Copiloto / Inteligencia / Notificaciones
**Tipo:** Decisión de arquitectura y producto
**Fecha:** 30/08/2026

---

## 1. Contexto

Private Balance dispone de un Copiloto capaz de interpretar información financiera y operativa almacenada localmente y responder consultas del usuario.

El Copiloto puede detectar situaciones relevantes sin necesidad de que el usuario formule previamente una pregunta, por ejemplo:

* desviaciones importantes frente a la Meta de temporada;
* gastos inusuales;
* disminuciones relevantes de ingresos;
* proximidad del cierre de una temporada;
* información pendiente que requiere intervención del usuario;
* citas o actividades que requieren una acción;
* inconsistencias detectadas en los datos;
* insights financieros derivados de la información disponible.

Actualmente no existe una decisión arquitectónica que determine cuándo estos hallazgos pueden convertirse en notificaciones proactivas.

Este ADR establece los límites de ese comportamiento.

El objetivo es que el Copiloto sea **útil sin ser intrusivo**, manteniendo los principios fundamentales de Private Balance:

* privacidad local;
* control del usuario;
* mínima interrupción;
* explicabilidad;
* ausencia de acciones financieras autónomas;
* respeto de las configuraciones existentes;
* comportamiento determinista cuando exista una regla explícita.

---

## 2. Decisión

Se permitirá que el Copiloto genere **notificaciones proactivas basadas en eventos o insights relevantes**, pero estarán sometidas obligatoriamente a una capa de política antes de mostrarse al usuario.

El flujo será:

```text
Datos / evento
      ↓
Motor financiero / Agenda / Reglas
      ↓
Detección de insight
      ↓
Copiloto
      ↓
Notification Policy Engine
      ↓
 ┌───────────────┬─────────────────┬─────────────────┐
 │ Mostrar ahora │ Agrupar/aplazar │      Omitir     │
 └───────────────┴─────────────────┴─────────────────┘
      ↓
Centro de notificaciones / UI / Push permitido
```

El Copiloto **no enviará directamente una notificación**.

Toda notificación deberá superar previamente:

1. validación de relevancia;
2. clasificación de prioridad;
3. comprobación de preferencias;
4. deduplicación;
5. control de frecuencia;
6. comprobación de contradicciones;
7. comprobación de vigencia;
8. evaluación de si existe realmente una acción posible para el usuario.

---

## 3. Principio fundamental

Una notificación proactiva deberá responder al menos a una de estas preguntas:

```text
¿Existe algo importante que el usuario debería conocer ahora?

¿Existe una acción razonable que el usuario puede realizar?

¿Esperar podría producir una consecuencia relevante?
```

Si las tres respuestas son negativas:

```text
NO NOTIFICAR
```

El hallazgo podrá permanecer disponible dentro del Copiloto o de una sección de insights sin interrumpir al usuario.

---

## 4. Tipos de notificación

Se establecen cuatro niveles.

### P0 — Crítica

Situación excepcional que requiere atención inmediata.

Ejemplos:

* riesgo de pérdida o corrupción de datos;
* fallo grave relacionado con backup/restauración;
* problema crítico de integridad de información;
* situación de seguridad que requiera intervención.

Comportamiento:

```text
Mostrar inmediatamente.
Puede utilizar notificación del sistema.
Puede superar horario silencioso cuando exista riesgo real.
No se agrupa con insights financieros normales.
```

P0 debe ser excepcional.

Los insights financieros normales nunca deberán convertirse automáticamente en P0.

---

### P1 — Acción requerida

Existe una situación concreta donde el usuario debe tomar una decisión o realizar una acción.

Ejemplos:

```text
La temporada termina próximamente y todavía no se ha cerrado.

Existe información necesaria para completar una operación.

Una acción iniciada necesita confirmación.

Existe una inconsistencia que requiere decisión del usuario.
```

Debe incluir siempre una acción clara.

Ejemplo:

```text
Tu temporada termina en 5 días.

Según los datos actuales has alcanzado el 82 % de la meta.

[Ver temporada]
```

---

### P2 — Insight relevante

Información importante pero que no requiere intervención inmediata.

Ejemplos:

```text
Tus gastos de esta semana son significativamente superiores
a tu promedio reciente.

Tu ritmo actual de ingresos está por debajo del necesario
para alcanzar la Meta de temporada.

Una categoría de gasto está creciendo de forma sostenida.
```

Comportamiento:

* preferentemente dentro de la aplicación;
* puede aparecer en el Copiloto;
* puede incorporarse a un resumen;
* normalmente no debe generar interrupciones repetidas.

---

### P3 — Informativa

Información útil pero no urgente.

Ejemplos:

```text
Resumen semanal disponible.

Has alcanzado un nuevo porcentaje de tu Meta.

Existe un patrón financiero que puede interesarte revisar.
```

Debe priorizar agrupación o digest.

No debe generar múltiples notificaciones individuales.

---

## 5. Notificaciones que requieren acción del usuario

Una notificación marcada como `ACTION_REQUIRED` deberá contener obligatoriamente:

```ts
{
  notificationId,
  type,
  priority,
  title,
  message,
  reason,
  createdAt,
  expiresAt?,
  action: {
    label,
    destination
  }
}
```

No se permitirá una notificación de acción requerida sin una acción disponible.

Ejemplo válido:

```text
Meta de temporada

Con el ritmo actual existe riesgo de no alcanzar
la meta antes del cierre.

[Ver progreso]
```

Ejemplo no válido:

```text
Tus ingresos podrían mejorar.
```

El segundo mensaje puede ser un insight conversacional, pero no una notificación que interrumpa al usuario.

---

## 6. El Copiloto recomienda, no ejecuta

Una notificación nunca podrá ejecutar automáticamente:

* creación de ingresos;
* creación de gastos;
* eliminación de registros;
* modificación de temporadas;
* modificación de metas;
* cambio de configuraciones;
* cierre de temporada;
* movimientos financieros;
* decisiones derivadas de recomendaciones.

El Copiloto puede:

```text
Detectar
Explicar
Recomendar
Abrir la pantalla correspondiente
Preparar una acción
```

Pero cualquier modificación persistente deberá seguir los mecanismos de confirmación establecidos por Private Balance.

---

## 7. Prioridad

Cada candidato a notificación deberá obtener una prioridad mediante:

```ts
priority = evaluateNotificationPriority(event, context)
```

La prioridad deberá considerar:

```text
urgencia
+
impacto potencial
+
proximidad temporal
+
capacidad del usuario para actuar
+
confianza del insight
```

La prioridad no deberá depender exclusivamente del modelo de IA.

Siempre que sea posible deberán utilizarse reglas deterministas.

Ejemplo:

```text
Temporada termina en <= 3 días
+
Meta < 80 %
=
P1
```

Mientras que:

```text
Gastos +12 % respecto al promedio
=
P2
```

---

## 8. Confianza mínima

Los insights inferidos deberán incorporar una puntuación de confianza.

Ejemplo:

```ts
{
  confidence: 0.87
}
```

Los insights de baja confianza no deberán producir notificaciones proactivas.

Regla inicial:

```text
confidence < 0.70
→ no generar notificación externa
```

Podrán seguir apareciendo dentro de una conversación si el usuario pregunta específicamente por ellos.

---

## 9. Frecuencia

El sistema deberá aplicar límites globales.

Configuración inicial recomendada:

```text
P0
Sin límite artificial cuando exista un evento crítico diferente.

P1
Máximo 3 notificaciones/día.

P2
Máximo 2 notificaciones/día.

P3
Preferentemente agrupadas.
Máximo 1 resumen/día.
```

Además:

```text
Máximo recomendado:
5 notificaciones proactivas no críticas/día.
```

Este límite deberá ser configurable posteriormente.

---

## 10. Cooldown

Una misma situación no deberá notificarse continuamente.

Cada tipo tendrá un período de enfriamiento.

Ejemplos iniciales:

```text
Meta en riesgo
24 horas

Gasto inusual
24 horas

Caída de ingresos
48 horas

Fin de temporada próximo
24 horas

Resumen financiero
7 días
```

El cooldown podrá finalizar antes si existe un cambio material en la situación.

---

## 11. Deduplicación

Cada notificación deberá disponer de una clave lógica:

```text
dedupKey
```

Ejemplo:

```text
season_goal_risk:{seasonId}
```

o:

```text
expense_anomaly:{category}:{period}
```

Antes de generar una notificación:

```ts
if (notificationAlreadyExists(dedupKey)) {
    suppress();
}
```

No deberán considerarse eventos diferentes pequeñas variaciones del mismo insight.

Ejemplo:

```text
Meta proyectada: 78 %
Meta proyectada: 77 %
Meta proyectada: 76 %
```

No deberán generar tres notificaciones.

Se mantendrá una única situación:

```text
META_EN_RIESGO
```

---

## 12. Cambio material

Una notificación previamente emitida podrá repetirse únicamente cuando exista un cambio significativo.

Ejemplo:

```text
Primera alerta:
Proyección de meta = 82 %

Nueva situación:
Proyección = 61 %
```

El deterioro puede justificar una nueva notificación.

El cambio material deberá definirse mediante reglas y no simplemente por cualquier cambio numérico.

---

## 13. Agrupación

Eventos relacionados deberán consolidarse.

En lugar de:

```text
Tus gastos aumentaron.

Tus ingresos bajaron.

Tu meta está en riesgo.
```

El sistema deberá preferir:

```text
Cambios importantes esta semana

• Los gastos aumentaron.
• Los ingresos están por debajo del promedio.
• Esto está afectando la Meta de temporada.

[Ver análisis]
```

El Copiloto podrá explicar posteriormente cada punto mediante conversación.

---

## 14. Prevención de contradicciones

Antes de mostrar una notificación deberá comprobarse el estado actual.

Ejemplo:

```text
10:00
Copiloto detecta:
"Meta en riesgo"

10:05
Usuario registra ingresos.

10:06
La meta deja de estar en riesgo.
```

Una notificación pendiente generada a las 10:00 deberá cancelarse.

Por tanto:

```text
detect
↓
queue
↓
revalidate
↓
notify
```

Nunca:

```text
detect
↓
notify sin comprobar estado
```

---

## 15. Vigencia

Toda notificación susceptible de quedar obsoleta deberá disponer de:

```text
expiresAt
```

Cuando:

```text
now > expiresAt
```

la notificación no deberá mostrarse.

---

## 16. Privacidad local

Las notificaciones del Copiloto respetarán el principio **local-first** de Private Balance.

Los datos financieros utilizados para decidir una notificación permanecerán en el dispositivo siempre que técnicamente sea posible.

No se enviarán automáticamente a servicios externos:

* importes;
* ingresos;
* gastos;
* categorías;
* metas;
* información de temporadas;
* información de agenda;
* contenido financiero sensible.

El Notification Policy Engine deberá poder funcionar localmente.

---

## 17. Privacidad del contenido visible

Las notificaciones del sistema operativo no deberán mostrar información financiera sensible por defecto.

Ejemplo NO recomendado:

```text
Hoy has ganado 840 € y gastado 275 €.
```

Ejemplo recomendado:

```text
Private Balance

Tienes un nuevo insight financiero.

[Ver]
```

El detalle deberá visualizarse después de acceder a Private Balance y superar los mecanismos de privacidad configurados.

Opcionalmente podrá existir:

```text
Configuración
→ Notificaciones
→ Mostrar detalles financieros
```

Desactivado por defecto.

---

## 18. Respeto de configuraciones existentes

El Copiloto deberá respetar las preferencias funcionales de Private Balance.

Ejemplo importante:

Si:

```text
Reportar ingresos = OFF
```

el Copiloto:

```text
NO deberá generar
"tienes ingresos pendientes de reportar"
```

ni mensajes equivalentes.

La configuración únicamente modifica esa experiencia de reporte.

No deberá modificar:

* cálculos financieros;
* ingresos;
* gastos;
* ganancias;
* Meta de temporada;
* estadísticas;
* reportes.

---

## 19. Horario silencioso

El sistema deberá permitir:

```text
Configuración
→ Notificaciones
→ Horario silencioso
```

Ejemplo:

```text
22:00 – 08:00
```

Durante ese período:

```text
P2 → aplazar
P3 → aplazar
P1 → normalmente aplazar
P0 → podrá mostrarse cuando sea realmente crítico
```

---

## 20. Preferencias del usuario

Se añadirá conceptualmente:

```text
Configuración
└── Notificaciones
    ├── Notificaciones del Copiloto
    ├── Alertas importantes
    ├── Insights financieros
    ├── Resumen periódico
    ├── Agenda
    ├── Horario silencioso
    └── Mostrar información financiera
```

El usuario deberá poder desactivar los insights proactivos sin desactivar el Copiloto conversacional.

Esto significa:

```text
Copiloto conversacional
≠
Notificaciones del Copiloto
```

Son capacidades independientes.

---

## 21. Centro de notificaciones

Las notificaciones deberán persistir localmente para poder consultarse posteriormente.

Estados:

```ts
type NotificationStatus =
  | "new"
  | "seen"
  | "read"
  | "dismissed"
  | "acted"
  | "expired"
  | "suppressed";
```

Esto permitirá evitar repetir información que el usuario ya descartó.

---

## 22. Feedback del usuario

Cuando sea posible, las notificaciones P2/P3 podrán incorporar:

```text
Útil
No me interesa
No volver a avisarme de esto
```

Estas señales deberán modificar las preferencias de notificación, no los datos financieros.

---

## 23. Arquitectura propuesta

```text
┌──────────────────────────┐
│ Financial Data / Agenda  │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Event / Insight Detector │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Copilot Insight Engine   │
└────────────┬─────────────┘
             ↓
┌────────────────────────────────┐
│ Notification Policy Engine     │
│                                │
│ • relevance                    │
│ • priority                     │
│ • confidence                   │
│ • preferences                  │
│ • frequency                    │
│ • cooldown                     │
│ • deduplication                │
│ • contradiction detection      │
│ • expiration                   │
│ • privacy                      │
└────────────┬───────────────────┘
             ↓
┌──────────────────────────┐
│ Notification Repository  │
│       IndexedDB          │
└────────────┬─────────────┘
             ↓
       ┌─────┴─────┐
       ↓           ↓
   In-App       System
 Notification   Notification
```

---

## 24. Modelo de dominio sugerido

```ts
interface CopilotNotification {
  id: string;

  type: NotificationType;

  priority:
    | "P0"
    | "P1"
    | "P2"
    | "P3";

  source:
    | "financial"
    | "goal"
    | "season"
    | "agenda"
    | "security"
    | "system"
    | "copilot";

  title: string;

  message: string;

  reason?: string;

  confidence?: number;

  action?: {
    label: string;
    destination: string;
  };

  dedupKey: string;

  createdAt: string;

  expiresAt?: string;

  cooldownUntil?: string;

  status:
    | "new"
    | "seen"
    | "read"
    | "dismissed"
    | "acted"
    | "expired"
    | "suppressed";

  privacy:
    | "private"
    | "generic"
    | "user_allowed";
}
```

---

## 25. Regla de decisión

Antes de emitir:

```text
¿El evento sigue siendo válido?
        ↓
       Sí
        ↓
¿Tiene suficiente relevancia?
        ↓
       Sí
        ↓
¿Supera confianza mínima?
        ↓
       Sí
        ↓
¿Está permitido por configuración?
        ↓
       Sí
        ↓
¿Existe duplicado?
        ↓
       No
        ↓
¿Está en cooldown?
        ↓
       No
        ↓
¿Supera límite de frecuencia?
        ↓
       No
        ↓
¿Contradice información más reciente?
        ↓
       No
        ↓
¿Respeta privacidad?
        ↓
       Sí
        ↓
NOTIFICAR
```

Cualquier fallo:

```text
SUPPRESS / DEFER
```

---

## 26. Qué NO debe hacer el Copiloto

Queda explícitamente fuera del comportamiento permitido:

```text
❌ bombardear al usuario con insights;

❌ repetir el mismo insight con pequeñas variaciones;

❌ convertir cualquier anomalía estadística en alerta;

❌ mostrar importes sensibles en pantalla bloqueada por defecto;

❌ generar alertas basadas en datos antiguos;

❌ contradecir una situación financiera actualizada;

❌ ignorar configuraciones del usuario;

❌ ejecutar acciones financieras automáticamente;

❌ utilizar lenguaje alarmista;

❌ presentar una predicción como un hecho;

❌ generar notificaciones sin suficiente contexto;

❌ utilizar notificaciones para promocionar funciones del producto
   como si fueran insights financieros.
```

---

## 27. Lenguaje del Copiloto

Las notificaciones deberán ser descriptivas y no alarmistas.

Evitar:

```text
⚠️ ¡Estás gastando demasiado!
```

Preferir:

```text
Tus gastos están por encima de tu promedio reciente.

Puedes revisar qué categorías explican el cambio.
```

Evitar:

```text
No alcanzarás tu meta.
```

Preferir:

```text
Con el ritmo actual, la proyección está por debajo
de la Meta de temporada.
```

Las predicciones deberán identificarse siempre como:

```text
estimación
proyección
tendencia
```

y nunca como hechos futuros.

---

## 28. Métricas internas

El sistema podrá registrar localmente:

```text
generated
suppressed
delivered
opened
dismissed
acted
expired
```

Esto permitirá evaluar si el Copiloto está siendo útil o molesto.

No será necesario transmitir estas métricas fuera del dispositivo para que el sistema funcione.

---

## 29. Criterio de fatiga

Se considerará una señal de posible fatiga cuando:

```text
dismissed / delivered > 60 %
```

para una categoría durante un período significativo.

En ese caso el sistema podrá reducir automáticamente la frecuencia de esa categoría o sugerir al usuario modificarla.

Nunca deberá aumentar automáticamente la frecuencia.

---

## 30. Estrategia de implementación

No se recomienda activar simultáneamente todas las notificaciones proactivas.

### Fase 1 — Deterministas

Implementar únicamente:

```text
Fin de temporada próximo
Meta de temporada
Acciones pendientes reales
Agenda
Eventos críticos
```

Sin inferencias complejas.

---

### Fase 2 — Insights financieros

Añadir:

```text
variaciones importantes de ingresos;
variaciones importantes de gastos;
tendencias;
comparaciones;
proyecciones.
```

Siempre mediante reglas verificables.

---

### Fase 3 — Copiloto inteligente

Permitir que el Copiloto detecte relaciones más complejas entre:

```text
ingresos
+
gastos
+
meta
+
temporada
+
agenda
+
histórico
```

pero manteniendo siempre el Notification Policy Engine como frontera obligatoria.

---

## 31. Consecuencias

### Positivas

* El Copiloto pasa de ser únicamente reactivo a ofrecer valor proactivo.
* El usuario recibe información relevante sin tener que consultar constantemente.
* Se mantiene el control del usuario.
* Se reduce el riesgo de fatiga por notificaciones.
* La arquitectura permite incorporar nuevos insights progresivamente.
* La privacidad local continúa siendo un principio estructural.
* Se evita acoplar directamente la inteligencia con los canales de notificación.

### Negativas

* Aumenta la complejidad del sistema.
* Requiere almacenamiento del estado de notificaciones.
* Requiere reglas de deduplicación y cooldown.
* Los umbrales deberán ajustarse mediante pruebas reales.
* Algunos insights útiles podrían inicialmente ser suprimidos por políticas demasiado conservadoras.

Se considera preferible perder ocasionalmente una notificación P2/P3 antes que deteriorar la confianza del usuario mediante exceso de interrupciones.

---

## 32. Decisión final

Private Balance adoptará un modelo de:

```text
COPILOTO PROACTIVO CONTROLADO
```

y no un modelo de:

```text
COPILOTO QUE NOTIFICA TODO LO QUE DETECTA
```

La arquitectura deberá mantener obligatoriamente la separación:

```text
Insight
≠
Notificación
```

Un insight es información detectada.

Una notificación es una decisión de interrumpir o llamar la atención del usuario.

Por tanto:

```text
Insight
   ↓
Policy Engine
   ↓
Notificación
```

El **Notification Policy Engine** será la autoridad final para decidir si un insight del Copiloto:

```text
se muestra,
se agrupa,
se aplaza,
se convierte en resumen,
o se descarta.
```

---

## 33. Criterios de aceptación arquitectónicos

La implementación se considerará conforme con este ADR cuando:

* [ ] El Copiloto no pueda emitir directamente notificaciones.
* [ ] Exista una capa independiente de política de notificaciones.
* [ ] Todas las notificaciones tengan prioridad.
* [ ] Exista `dedupKey`.
* [ ] Exista control de frecuencia.
* [ ] Exista cooldown.
* [ ] Se revalide el insight antes de mostrarlo.
* [ ] Las notificaciones obsoletas puedan expirar.
* [ ] Se respeten preferencias del usuario.
* [ ] Se respete `Reportar ingresos = OFF`.
* [ ] Los datos financieros sensibles permanezcan ocultos por defecto en notificaciones externas.
* [ ] El usuario pueda desactivar notificaciones proactivas sin desactivar el Copiloto.
* [ ] P1 tenga siempre una acción asociada.
* [ ] P2/P3 puedan agruparse.
* [ ] Las predicciones se identifiquen como estimaciones.
* [ ] Ninguna notificación pueda modificar datos financieros automáticamente.
* [ ] Las decisiones de suppress/dedup/cooldown puedan probarse mediante tests automatizados.

---

## 34. Fase 1.5 — Entrega nativa Android

La Fase 1 (secciones 1-33) implementó el pipeline completo hasta el Centro de notificaciones y la
campana in-app. La Fase 1.5 añade una segunda superficie de entrega — notificación nativa Android —
sin tocar ninguna de las decisiones que este ADR ya fija: el `NotificationPolicyEngine` sigue siendo
la única autoridad sobre si una situación merece notificarse.

### 34.1 Decisión de tecnología

Se usa **`@capacitor/local-notifications`** como único canal Android, reutilizando la misma librería
que Agenda ya usa para recordatorios de citas (`src/services/reminderService.ts`).

Razones:

* Local-first: no requiere servidor ni conectividad.
* Ya está integrada en el proyecto — no se añade una segunda dependencia nativa.
* Privacidad: el contenido nunca sale del dispositivo.
* Suficiente para el alcance actual (P0/P1); no se necesita FCM/push remoto para notificar algo
  que la propia app ya decidió y persistió localmente.

Explícitamente **fuera de alcance**: Firebase Cloud Messaging, push remoto, Supabase, cualquier
backend de notificaciones, WorkManager, o inteligencia en segundo plano.

### 34.2 Arquitectura

```text
NotificationCandidate
        ↓
NotificationPolicyEngine        (sin cambios — única autoridad)
        ↓
CopilotNotification
        ↓
NotificationDeliveryService     (nuevo — determina canales autorizados y entrega, no re-evalúa reglas)
        ↓
   ┌────────────────┬────────────────┐
   ↓                                 ↓
InAppNotificationDelivery     AndroidNotificationDelivery
(Centro + campana,            (@capacitor/local-notifications,
 Dexie sigue siendo            canales `copilot-critical` / `copilot-important`)
 la fuente de verdad)
```

Una `CopilotNotification` puede tener presencia en dos canales (`delivery.inApp`, `delivery.android`)
pero sigue siendo un único registro — el `dedupKey`, el cooldown y los límites de frecuencia siguen
operando sobre la notificación lógica, nunca sobre el canal.

### 34.3 Política de canales

| Prioridad | Canales por defecto | Preferencia que lo habilita |
|---|---|---|
| P0 — crítica | in-app + Android | `androidNotificationsEnabled` (P0 no puede desactivarse individualmente) |
| P1 — acción requerida | in-app + Android | `androidNotificationsEnabled` + `androidActionRequiredEnabled` |
| P2 — insight relevante | solo in-app | preparado tras `androidFinancialInsightsEnabled` (OFF por defecto) |
| P3 — informativa | solo in-app | preparado tras `androidSummaryEnabled` (OFF por defecto) |

Centralizado en `src/notifications/delivery/notificationChannelPolicy.ts` — ningún otro componente
decide esto.

### 34.4 Permisos

* Se **comprueba** (`checkPermissions`) antes de cada entrega Android; nunca se **solicita** desde
  ese flujo en segundo plano.
* La solicitud (`requestPermissions`) solo ocurre desde una interacción explícita del usuario en
  Configuración → Notificaciones → "Permitir notificaciones nativas".
* Permiso `denied`: no se reintenta automáticamente, no se lanza excepción, las notificaciones
  in-app continúan funcionando con normalidad, y Configuración muestra un aviso informativo.

### 34.5 Privacidad

Con `showFinancialDetailsExternally = false` (valor por defecto) o `notification.privacy = 'private'`,
el contenido Android es genérico ("Private Balance — Una situación requiere tu atención. Toca para
revisar." o equivalente para no-P0) y nunca incluye importes, saldos, porcentajes ni descripciones de
operaciones. El detalle real solo aparece si el usuario activó el flag explícitamente y el tipo de
notificación lo permite.

### 34.6 Deep-link y estado `acted`

Al tocar una notificación Android se valida `action.destination` contra un allowlist de rutas
internas (`src/notifications/delivery/notificationDestination.ts` — rechaza `javascript:`, `data:`,
URLs externas y rutas protocol-relative) y se navega dentro de la app. La notificación pasa a
`status: 'acted'` mediante el mismo `NotificationService.markActed()` que ya usa el Centro — nunca se
crea un segundo registro. Tocar la notificación **nunca** ejecuta una acción financiera por sí solo.

### 34.7 Límite explícito

Local Notification ≠ inteligencia en segundo plano. Con la app completamente cerrada, JavaScript no
puede detectar un insight nuevo (p. ej. una Meta que acaba de entrar en riesgo); eso solo se evalúa
cuando la app está activa o vuelve a primer plano. Sí pueden llegar con la app cerrada los eventos que
ya se programaron nativamente con antelación (p. ej. una fecha de fin de temporada ya conocida), pero
la Fase 1.5 no introduce scheduling complejo de este tipo — solo entrega, en el momento de la decisión,
los eventos que el Policy Engine ya autorizó.

### 34.8 Hoja de ruta

* **Fase 1** — Notificaciones in-app (Centro + campana).
* **Fase 1.5** — Entrega nativa Android para P0/P1 (esta sección).
* **Fase 2** — Insights financieros avanzados.
* **Fase 3** — Copiloto con inteligencia más compleja / LLM.

---

## Resultado

Este ADR formaliza por primera vez el alcance de las notificaciones proactivas del Copiloto de Private Balance.

La existencia de este ADR **no implica que todas las capacidades descritas deban implementarse inmediatamente**.

Define la frontera arquitectónica que cualquier implementación presente o futura deberá respetar.

La Fase 1.5 (sección 34) extiende la entrega a un canal nativo Android sin alterar ninguna de las
decisiones de política fijadas en las secciones 1-33.
