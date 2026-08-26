# Auditoría de seguridad de Private Balance

**Fecha:** 2026-08-26  
**Commit auditado:** `b56c231`  
**Sitio auditado:** `https://finance.orpira.es`  
**Tipo:** revisión de código, configuración, dependencias y evaluación externa no destructiva  
**Estado:** hallazgos abiertos; requiere remediación y revalidación

**Nota de revisión:** este informe describe el commit `b56c231`. El árbol de
trabajo contiene una remediación aún no confirmada para PB-SEC-001, con
resolución canónica de `userCode` desde `license_devices` a partir del
`deviceCode` autenticado en `claims.sub`, rechazo de identidades discordantes
y pruebas específicas. El hallazgo no se considera cerrado hasta integrar y
revalidar esos cambios.

**Base de evidencia:** salvo indicación expresa de “árbol de trabajo”, las
referencias de código corresponden al objeto Git `b56c231` y deben consultarse
sobre ese commit. Las líneas del árbol local pueden haber cambiado y no
constituyen evidencia de cierre.

## 1. Resumen ejecutivo

Private Balance dispone de varios controles relevantes: HTTPS obligatorio, TLS moderno, HSTS, CORS restrictivo en las APIs examinadas, validación Zod en fronteras, consultas parametrizadas, licencias firmadas, JWT de vida corta, verificación de firma de webhooks y bloqueo durante el build de nombres conocidos de variables cliente que podrían contener secretos.

No se encontró evidencia de una intrusión activa, una clave expuesta en el bundle desplegado examinado, una inyección SQL confirmada, ejecución remota de comandos ni una fuga pública de datos financieros sin autenticación. La evaluación externa no autenticada tampoco reprodujo una vulnerabilidad crítica o alta de extremo a extremo desde la página pública. Estas ausencias son resultados acotados al método y a la ventana de observación; no cierran el riesgo canónico TD-002 de manejo de secretos ni sustituyen un escaneo del historial Git.

Sin embargo, el commit auditado no debe considerarse suficientemente endurecido para ampliar exposición en producción hasta corregir varios problemas de autorización y abuso del backend. El riesgo global del snapshot `b56c231` se clasifica como **ALTO** por estas razones:

1. El backend del commit auditado no vincula de forma consistente la identidad del JWT con los `userCode` y `deviceCode` aportados por el cliente; una ruta de consulta de canal construye su búsqueda con esa combinación.
2. La selección del canal WhatsApp para eventos financieros no queda acotada por dispositivo ni valida de forma explícita el backend configurado.
3. La elegibilidad del trial depende de un identificador de dispositivo controlado por el cliente, que se puede rotar.
4. Los JWT no expresan scopes ni entitlements por capacidad; el impacto económico depende de los proveedores y funciones habilitados.
5. La idempotencia usa patrones no atómicos que pueden duplicar efectos externos bajo concurrencia.
6. No se evidenció rate limiting distribuido en el repositorio; los controles externos no fueron verificados.

Además existen carencias de cabeceras del documento HTML, privacidad local, proceso de release, Android y dependencias. Son relevantes, pero no sustentan por sí mismas la clasificación global alta. La remediación local de PB-SEC-001 reduce una de las cadenas principales, pero todavía no forma parte del commit auditado ni cierra los demás hallazgos.

La probabilidad de que un atacante anónimo extraiga datos financieros directamente desde la portada pública parece baja con la evidencia disponible. El riesgo aumenta de forma material cuando el atacante obtiene un trial/JWT, conoce identificadores de otra cuenta, compromete una integración o consigue ejecutar JavaScript en el mismo origen.

## 2. Conclusión de riesgo

| Área | Nivel | Conclusión |
| --- | --- | --- |
| Transporte público | Bajo | TLS y HSTS se observaron correctamente durante la ventana externa |
| Cabeceras y framing del HTML | Medio | Faltan CSP aplicada al documento y protección anti-clickjacking |
| API pública de trial | Alto, condicionado al abuso | Identidad de dispositivo controlada por cliente y sin límite distribuido visible |
| Autorización multiusuario | Alto | En `b56c231` la identidad aportada por cliente no siempre se sustituye por identidad canónica |
| Automatización y WhatsApp | Alto, condicionado a funciones activas | Selección de canal incompleta, idempotencia no atómica y credencial n8n sin scopes |
| Proveedor de IA | Alto, condicionado a proveedor y cuota | JWT genérico; la ruta cliente heredada queda inoperable en el build canónico si se configura una clave prohibida |
| Neon/Postgres | Alto, condicionado a permisos reales | Rutas runtime ejecutan DDL; los grants productivos no se auditaron |
| Datos locales web | Medio, amenaza local | El PIN es barrera de UI, no cifrado de IndexedDB; token Google en `localStorage` |
| Dependencias y CI | Medio | Advisories con alcanzabilidad no demostrada; CI sí ejecuta lint, typecheck y tests, pero no build productivo ni gates específicos de seguridad |
| Android | Medio, condicionado al artefacto y dispositivo | Backup permitido y contenido sensible en notificaciones; el script genera un APK debug local, pero no se verificó distribución productiva |

**Respuesta directa:** no se confirmó un compromiso actual. Sí se confirmaron defectos de diseño y autorización en el snapshot, con cadenas plausibles de abuso entre usuarios, consumo no autorizado de proveedores, duplicación o pérdida de mensajes/eventos y exposición local en dispositivo. “Plausible” no significa “explotado”: las cadenas de extremo a extremo deben reproducirse en un entorno controlado. Los hallazgos P0 deben corregirse antes de ampliar exposición.

## 3. Alcance y metodología

### Incluido

- Cliente React/Vite, persistencia Dexie/IndexedDB y almacenamiento web.
- Funciones serverless de `api/` y lógica de `server/`.
- Autenticación, autorización, licencias, JWT, webhooks y mensajería.
- Integración con Neon según código y migraciones versionadas.
- Configuración Vercel, CI, dependencias npm, PWA y Android.
- Evaluación externa no destructiva de DNS, TLS, HTTP, CORS y endpoints públicos.
- Revisión de `npm audit` ejecutada el 2026-08-26.

### No incluido

- No se intentó fuerza bruta, fuzzing intensivo, bypass de autenticación ni explotación destructiva.
- No se accedió a datos financieros reales ni cuentas de terceros.
- No se inspeccionó el contenido de `.env*`, claves, tokens, licencias generadas o archivos con nombres sensibles.
- No se auditó la configuración interna de los paneles de Vercel, Neon, n8n, Meta, Evolution u OpenAI.
- No se realizó pentest autenticado con cuentas controladas de varios usuarios/dispositivos.
- No se auditó el historial Git con un scanner de secretos dedicado.
- No se evaluó infraestructura de terceros fuera de cómo el repositorio la consume.

### Escala de severidad

- **Crítica:** compromiso directo y generalizado con poca o ninguna precondición.
- **Alta:** acceso entre usuarios, abuso significativo, coste, integridad o exposición sensible con precondiciones realistas.
- **Media:** impacto acotado, defensa en profundidad importante o explotación con condiciones adicionales.
- **Baja:** hardening, privacidad limitada o impacto operativo menor.
- **Informativa:** observación sin vulnerabilidad directa demostrada.

### Estados de evidencia

- **Confirmado:** defecto reproducible en el snapshot o respuesta externa conservada.
- **Observado:** resultado puntual durante la ventana indicada.
- **Condicional:** el impacto depende de una precondición o configuración no verificada.
- **Explotado de extremo a extremo:** cadena completa reproducida en un entorno controlado.
- **No observado:** no detectado con los métodos indicados; no equivale a ausencia.

Ningún hallazgo de este informe se marca como explotado de extremo a extremo contra producción.

### Taxonomía

- `WEB-Axx:2021`: OWASP Top 10:2021.
- `APIx:2023`: OWASP API Security Top 10:2023.
- `MASVS-*`: OWASP Mobile Application Security Verification Standard v2.
- CWE se usa cuando describe mejor una debilidad concreta.

Las categorías ayudan a clasificar; no determinan por sí solas severidad ni explotabilidad.

## 4. Hallazgos prioritarios

### PB-SEC-001: identidad autenticada no vinculada a la identidad solicitada

**Severidad:** Alta  
**Estado:** Defecto confirmado en `b56c231`; cadena de abuso derivada del código, no explotada de extremo a extremo; remediación local con 21/21 pruebas focales, pendiente de integración y revalidación del despliegue  
**OWASP:** WEB-A01:2021 Broken Access Control / API1:2023 Broken Object Level Authorization

El JWT establece el dispositivo autenticado mediante `claims.sub`, pero algunos eventos aceptan `userCode` y `deviceCode` del payload y la resolución prefiere valores aportados por el cliente. El formato del identificador se valida, pero su pertenencia no se demuestra.

Existe además una ruta concreta de lectura: `/api/communication-channel` toma `userCode` de un header controlado por el cliente, combina ese valor con `claims.sub` y puede devolver teléfono, perfil y metadatos del proveedor si encuentra la pareja. El contrato también serializa `pairingCode`, pero no se confirmó que producción contuviera un valor no nulo. Como el trial permite solicitar o reactivar una licencia para un `deviceCode` elegido por el cliente, conocer el par usuario/dispositivo de otra cuenta podría permitir construir un JWT con el mismo subject y consultar el canal ajeno. Esta cadena depende, entre otras condiciones, de que el identificador no tenga un trial ya expirado y no se reprodujo contra datos reales.

**Evidencia:**

- `api/automation.ts:31-49,108-126`
- `api/communication-channel.ts:15-24,26-47,57-60`
- `server/automation/eventDispatcher.ts:31-54,87-118,171-178`
- `server/communicationChannelStore.ts:78-88`
- `server/trialLicenseService.ts:43-77`
- `test/eventDispatcherProviderIdentity.test.ts:31-53`

**Riesgo:** lectura de datos de canal entre usuarios, incluido un código de emparejamiento si existe y continúa vigente, además de confusión de canales u operaciones asociadas con una identidad ajena. Requiere conocer identificadores de la víctima, satisfacer las precondiciones del trial y obtener un JWT con subject coincidente.

**Corrección:** tratar `claims.sub` exclusivamente como `deviceCode`; derivar el `userCode` canónico de un único registro activo y vigente en `license_devices`; rechazar cualquier identidad suministrada por el cliente que no coincida y construir los eventos con la identidad canónica del servidor.

### PB-SEC-002: resolución WhatsApp incompleta por dispositivo/backend

**Severidad:** Alta  
**Estado:** Confirmado en `b56c231`; explotación de extremo a extremo no reproducida  
**OWASP:** WEB-A01:2021 Broken Access Control / API1:2023 Broken Object Level Authorization

La consulta activa filtra por usuario, proveedor y estado, pero no por `device_code` ni por el backend WhatsApp configurado. En caso de varias filas elige por recencia.

**Evidencia:**

- `server/automation/communicationResolver.ts:98-114`
- `server/automation/eventDispatcher.ts:138-169`
- `server/migrations/006_add_meta_cloud_channel_fields.sql:91-102`

**Riesgo:** eventos de un dispositivo pueden enriquecerse con el canal de otro dispositivo del mismo usuario. En combinación con PB-SEC-001, la identidad ajena podría ampliar el efecto entre usuarios; PB-SEC-002 por sí solo no demuestra cruce de tenant.

**Corrección:** resolver por `user_code + device_code + provider + whatsapp_backend + status`; fallar cerrado si hay ambigüedad en lugar de elegir la fila más reciente.

### PB-SEC-003: elegibilidad de trial evadible mediante rotación de `deviceCode`

**Severidad:** Alta  
**Estado:** Defecto confirmado en `b56c231`; automatización del abuso no probada  
**OWASP:** WEB-A04:2021 Insecure Design / API6:2023 Unrestricted Access to Sensitive Business Flows; API4:2023 como impacto secundario de consumo

El endpoint público acepta un identificador elegido por el cliente y la elegibilidad se limita a ese valor. Rotarlo no renueva el grant anterior: crea otra identidad de aplicación que puede obtener un trial firmado independiente.

**Evidencia:**

- `api/trial-start.ts:19-40`
- `server/trialLicenseService.ts:47-54,89-105`
- `server/neonTrialGrantsRepository.ts:25-31,53-61`

**Riesgo:** obtención repetida de trials bajo identificadores nuevos, crecimiento de base de datos y acceso continuado a capacidades disponibles para licencias trial. La escala efectiva depende de límites externos no auditados.

**Corrección:** combinar cuenta/contacto verificado, límites distribuidos por IP/dispositivo/cuenta, detección de anomalías y attestation donde sea aplicable. No considerar un UUID cliente como prueba de dispositivo físico.

### PB-SEC-004: JWT genérico sin scopes, entitlement ni cuota

**Severidad:** Alta, condicionada a proveedores y capacidades habilitados  
**Estado:** Ausencia de scopes y entitlements confirmada en `b56c231`; consumo real no medido  
**OWASP:** WEB-A01:2021 Broken Access Control / API5:2023 Broken Function Level Authorization

Los JWT contienen identidad y tipo de licencia, pero no scopes por endpoint ni capacidades verificadas. El proxy de IA acepta cualquier JWT válido y las operaciones de comunicación comparten la misma frontera de autorización.

**Evidencia:**

- `server/automationSecurity.ts:62-70,180-252`
- `api/automation-token.ts:37-57`
- `api/ai-provider-openai.ts:83-101`
- `server/automation/providers/whatsapp/MetaCloudWhatsAppProvider.ts:211-244`

**Riesgo:** un trial puede invocar endpoints protegidos con el mismo tipo de JWT y consumir recursos de IA, mensajería u otras funciones si están habilitados. No se verificaron las cuotas ni políticas configuradas directamente en los proveedores.

**Corrección:** scopes como `automation:dispatch`, `ai:invoke` y `whatsapp:manage`; entitlements derivados de licencia verificada; cuotas por usuario/dispositivo/proveedor; introspección de licencia activa para operaciones costosas.

### PB-SEC-005: idempotencia no atómica antes de efectos externos

**Severidad:** Alta, condicionada a concurrencia y efectos externos habilitados  
**Estado:** Carrera confirmada en código; duplicación real no reproducida  
**OWASP:** WEB-A04:2021 Insecure Design

El flujo consulta si existe una clave, ejecuta el efecto y registra el resultado. Dos solicitudes concurrentes pueden superar la consulta y ejecutar el mismo envío. En webhook, `ON CONFLICT DO NOTHING` no distingue correctamente quién adquirió el claim.

**Evidencia:**

- `server/communication/services/idempotencyService.ts:24-50`
- `server/communication/repositories/idempotencyRepository.ts:93-101`
- `server/communication/services/metaWebhookService.ts:26-33`
- `server/communication/services/outboundMessageService.ts:51-167`

**Riesgo:** dos solicitudes concurrentes pueden ejecutar más de una vez envíos de Meta, marcado de lectura, actualización de estados o reenvíos a n8n. El commit no demuestra cobros financieros duplicados; el consumo duplicado de cuota o coste depende del efecto externo habilitado.

**Corrección:** claim atómico con `INSERT ... ON CONFLICT DO NOTHING RETURNING`, estados `processing/completed/failed`, lease de recuperación y outbox/inbox durable.

### PB-SEC-006: ausencia de rate limiting distribuido visible en el repositorio

**Severidad:** Alta, condicionada a controles externos y escala del abuso  
**Estado:** Ausencia confirmada en repositorio; WAF, límites de plataforma y cuotas de proveedor no verificados  
**OWASP:** API4:2023 Unrestricted Resource Consumption

Los endpoints de trial, token, automatización e IA no muestran un limitador distribuido. El único limitador encontrado es por proceso y se documenta como insuficiente en serverless. El trial es público; automatización e IA requieren un JWT válido y la emisión del token exige una licencia firmada.

**Evidencia:**

- `api/trial-start.ts:28-40`
- `api/automation-token.ts:31-59`
- `api/automation.ts:102-126`
- `api/ai-provider-openai.ts:83-101`
- `server/communication/security/rateLimiter.ts:1-11`

**Riesgo:** agotamiento de Vercel, Neon, n8n, OpenAI o WhatsApp, con coste o denegación de servicio según la ruta y credencial disponible. Las cuotas y entitlements por capacidad pertenecen a PB-SEC-004 y la elegibilidad de trial a PB-SEC-003; no se contabilizan de nuevo como impactos independientes.

**Corrección:** límites distribuidos por IP, dispositivo, licencia, usuario, endpoint y unidad de coste; presupuestos diarios/mensuales; WAF/bot protection para endpoints públicos; alertas y kill switches.

### PB-SEC-007: DDL ejecutado por rutas runtime; privilegios productivos no verificados

**Severidad:** Alta, condicionada a los grants efectivos  
**Estado:** El diseño runtime requiere DDL; grants, roles y RLS efectivos del despliegue no verificados  
**OWASP:** WEB-A05:2021 Security Misconfiguration

Las rutinas de inicialización ejecutan DDL, backfills y creación de funciones durante solicitudes normales usando la conexión de runtime. Las migraciones inspeccionadas no contienen controles activos de `GRANT`, `REVOKE` o RLS, pero el repositorio no permite afirmar qué permisos adicionales existen en producción.

**Evidencia:**

- `server/licenseDeviceRegistry.ts:253-303`
- `server/communication/repositories/idempotencyRepository.ts:13-38`
- `server/communication/repositories/correlationRepository.ts:18-49`
- `server/communication/repositories/messageStatusRepository.ts:19-46`
- `server/migrations/*.sql`

**Riesgo:** si la credencial de runtime es comprometida, puede permitir cambios de esquema y acceso transversal mayor al necesario.

**Corrección:** mover toda evolución de esquema a un proceso de migración con rol propietario separado; conceder al rol runtime solo las operaciones necesarias; evaluar RLS como defensa adicional y proteger la rama productiva.

### PB-SEC-008: PIN no cifra los datos y permite fuerza bruta local

**Severidad:** Media, amenaza local  
**Estado:** Confirmado; no es una vulnerabilidad remota  
**OWASP:** MASVS-STORAGE / MASVS-AUTH

El PIN de 4 a 6 dígitos usa PBKDF2, pero solo controla el montaje de UI. Los datos financieros permanecen sin cifrar en IndexedDB y el verificador se duplica en `localStorage`. No hay throttling ni lockout.

**Evidencia:**

- `src/utils/pin.ts:3-4,50-58`
- `src/services/pinService.ts:14-22`
- `src/components/PinGate.tsx:93-106`
- `src/services/settingsService.ts:22-24,57-71`
- `src/database/db.ts:82-112`

**Riesgo:** quien accede al perfil del navegador puede leer IndexedDB sin superar la UI o atacar offline un espacio total de 1.110.000 combinaciones para PIN de 4, 5 y 6 dígitos. El PIN no protege datos en reposo.

**Corrección:** comunicar que es una pantalla de privacidad hasta implementar cifrado; aplicar throttling exponencial; evitar duplicar el hash; en Android usar autenticación y keystore del sistema; evaluar passphrase si deriva material criptográfico.

### PB-SEC-009: advisories de dependencias con alcanzabilidad no determinada

**Severidad:** Media  
**Estado:** Revalidado con el registro npm el 2026-08-26; alcanzabilidad no demostrada  
**OWASP:** WEB-A06:2021 Vulnerable and Outdated Components

Con Node `v24.19.0` y npm `11.17.0`, `npm audit --json` reportó 23 paquetes afectados en el grafo completo: 1 crítico, 18 altos y 4 moderados. `npm audit --omit=dev --json` reportó 11: 9 altos y 2 moderados. Estos conteos agrupan paquetes con severidad propagada y dependen del registro mutable de advisories; no equivalen a 23 vulnerabilidades independientes ni prueban alcanzabilidad en el navegador. `--omit=dev` tampoco equivale a runtime web porque varias herramientas de build figuran en `dependencies`.

**Rutas principales:**

- `tar` y `sharp` mediante `@capacitor/assets`: tooling de assets/build; aparecen en el grafo completo y no en `--omit=dev`.
- `dompurify` mediante jsPDF (`GHSA-55q2-fjhq-7xh7`): moderada; no se confirmó que Private Balance invoque la ruta vulnerable.
- `fast-uri` mediante Workbox/Ajv (`GHSA-7p8r-x3mc-p8w7`): alta; `vite-plugin-pwa` está instalado pero no registrado en Vite.
- `nanoid` mediante Vite/PostCSS (`GHSA-2v37-7h3g-55p8`): alta; no se confirmó uso de un generador con tamaño cero.

**Evidencia:**

- `package-lock.json:1783-1787,5848-5856,6429-6443,9008-9024,10757-10772`
- `package.json:47,51-53`
- Comandos: `npm audit --json` y `npm audit --omit=dev --json`.

**Riesgo:** DoS, escritura de archivos u otros impactos durante build/procesamiento de entradas manipuladas, además de dependencias transitivas cuyo alcance runtime requiere análisis por ruta. No se confirmó una cadena de compromiso del build ni explotación web.

**Corrección:** actualizar de forma controlada, revisar `@capacitor/assets`, retirar `vite-plugin-pwa` mientras esté inactivo, no ejecutar `npm audit fix` ciegamente y añadir un gate de advisories con excepciones documentadas.

## 5. Hallazgos adicionales

### PB-SEC-010: HTML sin CSP ni protección anti-clickjacking

**Severidad:** Media  
**Estado:** Observado en despliegue y confirmado en configuración  
**OWASP:** WEB-A05:2021 Security Misconfiguration

`GET /` no devolvió CSP ni `X-Frame-Options`. Las APIs sí aplican `frame-ancestors 'none'`, pero eso no protege la aplicación React.

**Evidencia:**

- Respuesta de `https://finance.orpira.es/` observada el 2026-08-26 08:48 UTC.
- `vercel.json:1-12`
- `index.html`
- `server/apiUtils.ts:81-91`

**Riesgo:** clickjacking y mayor impacto de una futura inyección de scripts.

**Corrección:** aplicar de inmediato una política mínima enforced con `frame-ancestors 'none'`, `object-src 'none'` y `base-uri 'none'`; ensayar en report-only las directivas que puedan afectar scripts, conexiones, imágenes, Google OAuth y generación de reportes antes de aplicarlas. `X-Frame-Options: DENY` puede añadirse como compatibilidad, no sustituye a CSP.

### PB-SEC-011: sinks HTML activos y reportes sin sandbox

**Severidad:** Baja  
**Estado:** Sinks privilegiados confirmados; los builders examinados escapan los campos dinámicos y no se confirmó XSS

Los reportes usan `document.write`, `srcDoc` sin `sandbox` e `innerHTML`. Los builders examinados escapan los campos dinámicos, incluido el contenido importable revisado. El riesgo actual es de defensa en profundidad: una regresión de escape tendría mayor impacto por la falta de aislamiento.

**Evidencia:**

- `src/pages/Reports/ReportPreviewPage.tsx:39-52,146-151`
- `src/services/reportShareService.ts:62-105`
- `src/pages/Reports/ReportsPage.tsx:116-123,694-727`

**Riesgo:** no se demostró una carga XSS actual. Una futura ruta que inserte texto sin escapar podría ejecutar contenido con los privilegios del origen.

**Corrección:** sandbox de iframes sin scripts/same-origin cuando sea viable; renderizado inerte; sanitización rigurosa; Trusted Types y pruebas CSP.

### PB-SEC-012: ruta heredada de OpenAI apta para credencial en navegador

**Severidad:** Media  
**Estado:** Ruta cliente peligrosa confirmada; queda inoperable en el build canónico cuando se configura la variable prohibida; no se confirmó credencial expuesta

El cliente conserva lectura de `VITE_OPENAI_API_KEY`, base URL configurable y `dangerouslyAllowBrowser: true`. El build canónico aborta si se configura esa variable, por lo que la ruta no puede activarse sin modificar o eludir una barrera privilegiada. Existe una composición proxy más segura, pero la UI principal referencia la composición heredada.

**Evidencia:**

- `src/pages/Conversation/ConversationPage.tsx:42-47`
- `src/pages/Conversation/conversationComposition.ts:197-204`
- `src/intelligence/ai-provider/openAIConfiguration.ts:101-164`
- `src/intelligence/ai-provider/openAIAdapter.ts:280-287,413-432`
- `vite.config.ts:7-15`
- `src/config/forbiddenClientSecrets.ts:1-32`

**Riesgo:** una modificación o bypass futuro del build podría exponer una credencial de proveedor en el navegador. El estado auditado no demuestra una fuga productiva.

**Corrección:** retirar del código cliente toda aceptación de API key; usar exclusivamente proxy autenticado; consentimiento versionado y explícito antes de enviar contexto financiero; minimización y revocación.

### PB-SEC-013: token Google Drive en `localStorage` y reset incompleto

**Severidad:** Media  
**Estado:** Persistencia y omisión del reset confirmadas; explotación condicionada a XSS o acceso local

El access token se almacena en `localStorage` y el reset de seguridad no elimina esa clave específica.

**Evidencia:**

- `src/services/googleDriveBackupService.ts:2-4,48-75,157-170`
- `src/services/securityRecoveryService.ts:8-20`

**Riesgo:** un XSS del mismo origen o un atacante local puede leer el bearer token. El restablecimiento deja la credencial utilizable hasta su expiración, aunque el scope `drive.appdata` y el cifrado de los backups reducen el impacto. El token no forma parte del backup JSON.

**Corrección:** registro central de claves sensibles y test de borrado completo; secure storage/keystore en Android; revocación al desconectar o restablecer.

### PB-SEC-014: inyección de fórmulas CSV

**Severidad:** Baja, condicionada a datos de terceros y apertura en una hoja compatible  
**Estado:** Falta de neutralización confirmada; ejecución de fórmula no reproducida  
**CWE:** CWE-1236 Improper Neutralization of Formula Elements in a CSV File

Los campos se escapan sintácticamente para CSV, pero no se neutralizan prefijos de fórmula de hojas de cálculo.

**Evidencia:**

- `src/services/incomeExportService.ts:62-107,214-227`

**Riesgo:** si datos controlados por terceros llegan a campos textuales de un ingreso y otra persona abre el CSV en una hoja compatible, una fórmula puede evaluarse y realizar solicitudes externas. El flujo local ordinario y el formato SpreadsheetML no se demostraron explotables.

**Corrección:** neutralizar prefijos de fórmula solo en columnas textuales controlables por el usuario, incluyendo whitespace y variantes Unicode previas. No anteponer apóstrofos a importes, fechas ni valores canónicos: las pruebas deben preservar montos negativos y la semántica numérica del exportable.

### PB-SEC-015: importación de backup sin límites completos

**Severidad:** Media  
**Estado:** Confirmado como frontera local de importación; requiere selección voluntaria de un archivo

El archivo se lee completo, no tiene límite previo de tamaño y la validación de entidades anidadas es parcial. La sustitución sí es transaccional y valida relaciones financieras centrales antes de borrar; el hallazgo no invalida esas garantías acotadas.

**Evidencia:**

- `src/services/backupService.ts:129-178,318-323`
- `src/database/db.ts:981-1065`

**Riesgo:** agotamiento local de memoria, restauración de registros no validados completamente y persistencia de URLs hostiles después de importar voluntariamente un archivo manipulado.

**Corrección:** límites de bytes/filas/longitud; esquemas Zod versionados por colección; invariantes cruzadas; rechazo de settings sensibles desconocidos.

### PB-SEC-016: QR remoto permite tracking por URL HTTPS arbitraria

**Severidad:** Baja  
**Estado:** Restauración sin revalidación confirmada; tracking condicionado a importar un backup manipulado y abrir la pantalla

La restauración persiste el objeto de canal sin volver a aplicar `normalizeQrCode`. Una URL HTTPS manipulada puede quedar como `qrCode` y la UI la carga como imagen.

**Evidencia:**

- `src/services/communicationChannelService.ts:181-202,253-260`
- `src/pages/Settings/CommunicationChannelsPage.tsx:265-271`
- `src/services/backupService.ts:201-214`

**Riesgo:** un backup manipulado puede provocar desde el navegador una petición de tracking que revela IP y momento de uso. No es SSRF del servidor ni se confirmó ejecución de JavaScript.

**Corrección:** almacenar bytes validados o usar proxy confiable; allowlist de hosts; `referrerPolicy="no-referrer"`; revalidar datos restaurados; restringir `img-src` en CSP.

### PB-SEC-017: límites de cuerpo de aplicación eludibles sin `Content-Length`

**Severidad:** Baja; aumenta en combinación con PB-SEC-006  
**Estado:** Bypass del umbral de aplicación confirmado; límite de plataforma no verificado  
**OWASP:** API4:2023 Unrestricted Resource Consumption

El helper común confía en `Content-Length`, que puede faltar o ser inválido. Esto permite superar los umbrales menores definidos por la aplicación, aunque el cuerpo continúa sujeto al límite de la plataforma. El webhook Meta sí mide bytes del stream.

**Evidencia:**

- `server/apiUtils.ts:134-140`
- `server/communication/security/rawBody.ts:13-33`

**Riesgo:** mayor consumo de parseo y validación y bypass de controles por endpoint, acotado por el límite de plataforma.

**Corrección:** medir bytes reales antes del parseo cuando el runtime lo permita; documentar el límite de plataforma; mantener Zod como segunda barrera.

### PB-SEC-018: errores upstream sin normalización uniforme

**Severidad:** Media  
**Estado:** Rutas de propagación sin normalizar confirmadas; divulgación sensible real no observada  
**OWASP:** API8:2023 Security Misconfiguration / CWE-209

`dispatchWebhook` registra el cuerpo arbitrario de un error de n8n y lo devuelve en el resultado; `/api/automation` reenvía ese cuerpo y estado sin un esquema público. Separadamente, otras rutas pueden devolver mensajes de excepciones internas.

**Evidencia:**

- `server/automation/webhookDispatcher.ts:167-179`
- `api/automation.ts:123-133`
- `api/license-activate.ts:54-65`
- `api/communication-channel.ts:61-65`

**Riesgo:** un caller autenticado o los logs podrían recibir detalles internos, datos reflejados por n8n o información de consultas si el upstream o el driver producen mensajes sensibles. No se confirmó una exposición concreta en producción.

**Corrección:** códigos públicos cerrados y logging redactado; nunca reenviar cuerpos arbitrarios de n8n.

### PB-SEC-019: webhook Meta confirma recepción aunque falle el procesamiento

**Severidad:** Media  
**Estado:** Confirmado en código; pérdida real no reproducida  
**OWASP:** WEB-A04:2021 Insecure Design

El endpoint devuelve `200` después de capturar errores de procesamiento. El servicio también captura fallos por mensaje o estado, y el forwarder a n8n devuelve fallos reintentables sin propagarlos ni persistirlos en una inbox durable.

**Evidencia:**

- `api/communication/meta/webhook.ts:71-82`
- `server/communication/services/metaWebhookService.ts:89-131`
- `server/communication/services/n8nInboundForwarder.ts:36-83,111-119,144-153`

**Riesgo:** pérdida permanente de mensajes/estados si Neon o n8n falla transitoriamente y Meta no reintenta.

**Corrección:** persistir primero en inbox durable; procesar con reintentos/dead letter; devolver no-2xx si no se pudo aceptar de forma durable.

**Relación:** comparte la remediación inbox/outbox con PB-SEC-005, pero representa pérdida de eventos y no ejecución duplicada.

### PB-SEC-020: `device_code` no es globalmente único y su resolución es ambigua

**Severidad:** Media  
**Estado:** Confirmado en `b56c231`; subcausa de PB-SEC-001, no contabilizada como riesgo independiente; remediación local pendiente de integración  
**OWASP:** WEB-A01:2021 Broken Access Control / API1:2023 Broken Object Level Authorization

La base hace único el dispositivo dentro de una licencia, pero otro lookup busca solo por dispositivo y selecciona la fila activa más reciente.

**Evidencia:**

- `server/migrations/001_license_devices.sql:15-27`
- `server/automation/communicationResolver.ts:126-144`

**Riesgo:** si el mismo identificador está activo bajo licencias o usuarios distintos, la identidad resuelta depende de la fila más reciente y puede seleccionar otro tenant.

**Corrección:** exigir una única asociación activa global o incluir un identificador inmutable de licencia-dispositivo en el JWT y consultar por él; rechazar cero o múltiples asociaciones.

### PB-SEC-021: credencial de servicio n8n única y sin scopes por operación o tenant

**Severidad:** Media; alta si el envío real está habilitado y la credencial se comparte entre varios workflows  
**Estado:** Diseño confirmado en código; distribución efectiva de la credencial no verificada  
**OWASP:** WEB-A01:2021 Broken Access Control / API5:2023 Broken Function Level Authorization

Una clave estática autentica operaciones de estado, envío y marcado de lectura, y el payload puede elegir destinatario sin scope por workflow, operación o tenant.

**Evidencia:**

- `server/communication/config/metaCloudConfig.ts:42-68,110-120`
- `api/communication/whatsapp/[action].ts:50-147`
- `server/communication/contracts/outboundMessage.ts:16-43`
- `server/communication/services/outboundMessageService.ts:51-167`

**Riesgo:** cualquier poseedor de la clave puede invocar todas las operaciones y elegir destinatario cuando el envío real está activo, ampliando el impacto de una fuga o workflow comprometido.

**Corrección:** tokens de servicio cortos con scopes por workflow, operación, canal y destinatario; separar privilegios y rotar credenciales.

### PB-SEC-022: Vercel omite el build canónico y CI carece de build y gates de seguridad

**Severidad:** Media para integridad de release  
**Estado:** Confirmado

Vercel ejecuta `vite build` en vez de `npm run build`, omitiendo `tsc -b`. CI sí ejecuta lint, typecheck de app/API y tests, pero no el build productivo ni controles específicos de dependencias, secretos o artefactos.

**Evidencia:**

- `vercel.json:4`
- `package.json:9`
- `.github/workflows/ci.yml:9-32`

**Corrección:** usar `npm run build` en Vercel y CI; añadir una política de advisories con excepciones documentadas, secret scanning y required checks. Incorporar SAST, revisión del bundle, SBOM y provenance según el canal y madurez de distribución.

### PB-SEC-023: backup Android permitido y proceso basado en artefacto debug

**Severidad:** Media; alta si un APK debug se usa como release público  
**Estado:** Configuración de backup y generación local de APK debug confirmadas; inclusión efectiva de IndexedDB y distribución productiva no verificadas

Android habilita `allowBackup` sin reglas de exclusión. El script ejecuta `assembleDebug`, copia el APK a `dist/apk` y calcula su hash; la documentación describe su instalación manual, pero no prueba que se haya publicado o distribuido como release.

**Evidencia:**

- `android/app/src/main/AndroidManifest.xml:3-9`
- `scripts/build-apk.sh:53-97`
- `docs/08_DEPLOYMENT.md:79-100`

**Riesgo:** cloud backup o transferencia de datos locales sensibles, según versión de Android y comportamiento del dispositivo. Si el artefacto debug se distribuye a usuarios, añade depuración y firma no aptas para release.

**Corrección:** usar `allowBackup=false` o reglas explícitas y probadas mediante `dataExtractionRules`/`fullBackupContent`; generar un release firmado fuera del repositorio y verificar en el artefacto final que no sea debuggable, además de certificado, hash y provenance. No fijar `debuggable=false` en el manifest principal para ocultar la naturaleza de un build debug.

### PB-SEC-024: notificaciones sensibles visibles en pantalla bloqueada

**Severidad:** Media  
**Estado:** Visibilidad pública y contenido confirmados en código; visualización efectiva depende de OS y preferencias del usuario

Las notificaciones de citas pueden incluir notas; las de finalización de servicio pueden incluir ciudad, tipo de pago y monto.

**Evidencia:**

- `android/app/src/main/java/com/financeapp/app/MainActivity.java:28-39`
- `src/services/reminderService.ts:19-28,109-122`
- `src/services/serviceTimerNotificationService.ts:13-33,50-64`

**Corrección:** visibilidad privada/secreta por defecto, texto genérico en lock screen y opción explícita para revelar contenido. Migrar o versionar los IDs de canales existentes, porque Android conserva propiedades de canales ya creados.

## 6. Hallazgos bajos e informativos

### PB-SEC-025: cabeceras globales incompletas

**Severidad:** Baja  
**Estado:** Observado externamente; subhallazgo de PB-SEC-010, no contabilizado por separado

El HTML no devolvió `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`; las APIs examinadas sí. Aplicarlas globalmente en Vercel y validar que la política de permisos no bloquee capacidades requeridas.

### PB-SEC-026: autenticación ausente puede clasificarse erróneamente como `500`

**Severidad:** Baja  
**Estado:** Observado externamente y explicado por el código de `b56c231`; corregido en el árbol local, pendiente de integración

Una solicitud externa sin autorización/identidad válida devolvió `500`. En `b56c231`, la ausencia de bearer puede caer en el manejo genérico y responder `500`; con JWT válido y header de usuario ausente se responde `400`, mientras que un valor sintético no vacío no es inválido por esquema y normalmente produce `200` con canal nulo. Por tanto, atribuir ambos `500` al identificador era incorrecto y la solicitud externa original no quedó conservada con detalle suficiente para separar los casos.

**Evidencia:**

- `api/communication-channel.ts:15-65`
- Respuesta externa observada durante la ventana indicada.

**Corrección:** devolver `401` para bearer ausente o inválido, `400` para entrada malformada y un contrato no enumerativo documentado para canal inexistente. La identidad canónica debe venir del servidor, según PB-SEC-001.

### PB-SEC-027: falta `security.txt` y contacto real

**Severidad:** Informativa  
**Estado:** Confirmado en despliegue y repositorio

`/.well-known/security.txt`, ubicación normalizada por RFC 9116, devolvió `404`; `SECURITY.md:13-17` contiene un marcador sin correo configurado. El `404` de `/security.txt` no constituye por sí solo incumplimiento. Publicar el archivo en `/.well-known/` y verificar/habilitar GitHub Private Vulnerability Reporting si está disponible.

### PB-SEC-028: DNSSEC no observado

**Severidad:** Informativa  
**Estado:** No se observó un registro `DS` desde el resolver consultado; no se conservó evidencia suficiente sobre `DNSKEY`

No se observó un registro `DS` para `orpira.es` desde el resolver usado. DNSSEC es defensa operativa adicional, no una vulnerabilidad de la aplicación; la conclusión debe revalidarse con el registrador y resolvers independientes.

### PB-SEC-029: ausencia de prueba de regresión para source maps

**Severidad:** Informativa  
**Estado:** No se observaron source maps públicos; subhallazgo de PB-SEC-022

Vite deshabilita source maps por defecto y el bundle desplegado no mostró mapas públicos. No se confirmó una vulnerabilidad. Configurar `build.sourcemap: false` de forma explícita es opcional; el control más útil es una prueba del artefacto que evite regresiones.

### PB-SEC-030: exportación plaintext incluye settings sensibles

**Severidad:** Media, exposición voluntaria mediante exportación  
**Estado:** Confirmado en código; la UI advierte que el archivo no está cifrado

El backup JSON legible incluye settings completos que pueden contener el verificador de PIN y la clave de cifrado de backups. También puede incluir snapshots completos de canales con QR, código de vinculación, teléfono, perfil y metadatos del proveedor. No incluye el token de Google Drive, HTML de vista previa ni credenciales OpenAI. La UI advierte que el archivo es legible, pero una exportación plaintext no debería transportar material de autenticación o vinculación reutilizable.

**Evidencia:**

- `src/services/backupService.ts:166-171`
- `src/database/db.ts:938-976`
- `src/types/settings.ts:88-97`
- `src/types/communicationChannel.ts:8-30`
- `src/pages/Settings/SettingsBackupPage.tsx:522-538`

**Corrección:** excluir o redactar verificadores, claves, tokens, QR y códigos de vinculación; mantener la exportación legible como opción explícita y advertida, con el backup cifrado como opción predeterminada.

## 7. Evidencia favorable observada

- **Externa:** HTTP redirigió a HTTPS con `308`; TLS 1.2/1.3, certificado, HSTS y CAA se observaron correctamente durante la ventana auditada.
- **Externa:** no se observaron cookies en las respuestas públicas probadas.
- **Externa:** los preflight probados rechazaron el origen no confiable y permitieron same-origin con `Vary: Origin`. CORS es un control del navegador, no autorización.
- **Externa/configuración:** las APIs examinadas usan `Cache-Control: no-store` y cabeceras restrictivas; los endpoints POST examinados rechazaron GET con `405`.
- **Código:** Zod se usa en numerosas fronteras API; las consultas revisadas usan tagged templates parametrizados de Neon.
- **Código:** no se confirmó inyección SQL ni se encontró una ruta de shell, `eval` o comando controlado por request dentro del alcance revisado.
- **Código:** Meta verifica HMAC sobre raw body con comparación timing-safe; las licencias verifican ECDSA P-256/SHA-256.
- **Código:** el JWT fija HS256, issuer, audience, expiración y subject, con vida máxima de 15 minutos; esto no sustituye scopes ni revocación.
- **Código:** varias rutas aplican timeouts y límites de payload o tokens.
- **Build:** se bloquean nombres conocidos de variables `VITE_*` prohibidas; no es un scanner de valores secretos arbitrarios.
- **Artefacto:** no se observaron source maps públicos en el bundle desplegado examinado.
- **Código:** el backup cifrado usa PBKDF2-SHA256 y AES-256-GCM con salt e IV aleatorios; Google Drive limita el scope a `drive.appdata` y sube ciphertext.
- **Código:** el reemplazo de backup local es transaccional y valida relaciones financieras centrales antes de borrar, aunque PB-SEC-015 documenta validación parcial de otras entidades.

## 8. Plan de remediación

La prioridad de remediación es independiente de la severidad: P0 bloquea ampliar exposición; P1 bloquea liberar o usar la superficie afectada; P2 es defensa adicional planificada. Considera precondiciones, dependencia y alcance.

Este plan no reemplaza el backlog P0 canónico. TD-002 (manejo de secretos) y TD-003 (ramas n8n sin respuesta) permanecen abiertos en `docs/00_SYSTEM_ARCHITECTURE_MASTER.md` y no fueron revalidados aquí. No se inspeccionó material secreto y ninguna afirmación de este informe cierra esos riesgos.

### P0: antes de ampliar usuarios o declarar producción endurecida

| Orden | Acción | Hallazgos | Criterio de cierre |
| --- | --- | --- | --- |
| 1 | Identidad canónica desde JWT/dispositivo | 001, 020 | Pruebas cross-user/cross-device fallan cerrado en commit integrado y despliegue controlado |
| 2 | Canal por usuario + dispositivo + backend | 002 | Ninguna selección por recencia ambigua |
| 3 | Trial resistente a rotación y abuso | 003, 006 | Límite distribuido y política de elegibilidad verificable |
| 4 | Scopes, entitlements y cuotas | 004, 021 | Trial no puede invocar capacidades no autorizadas; credenciales de servicio quedan acotadas |
| 5 | Idempotencia atómica e inbox/outbox | 005, 019 | Test concurrente real no duplica efectos ni pierde eventos |

### P1: antes del release de las superficies afectadas

| Acción | Hallazgos | Criterio de cierre |
| --- | --- | --- |
| CSP/anti-clickjacking y headers globales | 010, 011, 025 | CSP enforce sin romper OAuth/reportes; framing bloqueado |
| Retirar proveedor OpenAI directo del navegador | 012 | Bundle no contiene ruta que acepte API key de proveedor |
| Corregir token/reset Google | 013 | Reset elimina/revoca todo token sensible |
| Neutralizar CSV e imports hostiles | 014, 015, 016 | Suite adversarial completa |
| Normalizar errores y body limits | 017, 018, 026 | Respuestas cerradas, tamaños reales medidos |
| Build/CI y dependencias | 009, 022, 029 | Build canónico, secret/artifact checks y política de advisories; rutas alcanzables resueltas y excepciones justificadas |
| Rol Neon de mínimo privilegio | 007 | Runtime no puede DDL; migración usa rol separado |
| Política PIN/datos en reposo | 008 | Threat model explícito, throttling y almacenamiento reforzado |
| Android antes de distribuir | 023, 024 | Release firmado, backup excluido y notificaciones privadas |

### P2: disclosure y defensa adicional

| Acción | Hallazgos | Criterio de cierre |
| --- | --- | --- |
| `security.txt` y contacto | 027 | Canal privado operativo y fecha de expiración publicada |
| DNSSEC | 028 | Decisión operativa documentada; habilitado si es viable |
| Export plaintext mínimo | 030 | No exporta verificadores, tokens ni claves de backup |

## 9. Pruebas de revalidación requeridas

1. Dos usuarios y dos dispositivos controlados: intentar todas las combinaciones de `userCode`, `deviceCode`, backend y JWT.
2. Prueba concurrente en PostgreSQL real de idempotencia, webhook e inbox/outbox.
3. Rate-limit test de baja intensidad en staging con IP/dispositivo/licencia y costes simulados.
4. Test de trial con rotación de UUID, NAT compartido y reintentos legítimos.
5. Aplicar `frame-ancestors 'none'` en enforcement y probar en report-only el resto de CSP sobre reportes, OAuth, APIs, imágenes y Capacitor antes de endurecerla.
6. Bundle scan de producción para secretos, rutas directas de proveedor y source maps; repetir `npm audit` con versiones de herramienta registradas y analizar alcanzabilidad por ruta.
7. Tests de fórmulas solo en campos CSV textuales, preservando montos negativos; backup sobredimensionado, registros inválidos y URLs de tracking.
8. Test de reset completo de IndexedDB, `localStorage`, tokens y secure storage.
9. Verificación de grants del rol Neon, rama protegida, TLS de conexión, auditoría y recuperación.
10. Inspección Android de Auto Backup/data extraction, firma release, `debuggable` y lock-screen.
11. Secret scanning del historial Git con rotación inmediata si aparece material real.
12. Revalidación de TD-003 sobre los workflows n8n realmente desplegados, incluidas todas las ramas y `Respond to Webhook`.
13. Pentest autenticado independiente después de cerrar P0/P1.

Durante la revisión documental se ejecutaron las suites focales `canonicalIdentity`, `communicationChannelEndpoint` y `eventDispatcherProviderIdentity`: 21/21 pruebas pasaron sobre la remediación local de PB-SEC-001. Esto valida el comportamiento unitario examinado, no el commit integrado, Neon real ni el despliegue.

## 10. Recomendaciones operativas externas

- Verificar en Vercel WAF, bot protection, límites por ruta, deployment protection, logs y alertas.
- Configurar presupuestos y alertas en OpenAI, Meta/WhatsApp, Neon y Vercel.
- Proteger la rama de producción de Neon y separar credenciales de migración/runtime.
- Evaluar IP Allow de Neon si el plan y la salida de Vercel permiten una lista estable; de lo contrario aplicar mínimo privilegio y monitorización como controles principales.
- Confirmar `sslmode=verify-full`; Neon recomienda este modo y exige TLS en todas las conexiones.
- Mantener secrets solo en entornos server-side y rotarlos con un runbook probado.
- Registrar eventos de autorización denegada, cambios de canal, emisión de trial, consumo de IA y envío de mensajes sin incluir datos financieros o tokens.
- Definir respuesta a incidentes: contención, revocación de JWT/licencias, rotación, preservación de evidencia y comunicación.

## 11. Evidencia externa observada y comandos de revalidación

**Ventana de observación:** 2026-08-26 08:48:28 UTC a 08:50:44 UTC.  
**Volumen:** solicitudes puntuales, sin enumeración masiva ni payloads de explotación.

Los siguientes comandos cubren las observaciones no autenticadas indicadas. No reproducen un pentest autenticado ni deben ejecutarse con tokens reales en logs compartidos:

```bash
curl -sS -D - -o /dev/null http://finance.orpira.es/
curl -sS -D - -o /dev/null https://finance.orpira.es/
curl -sS -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://example.invalid' \
  -H 'Access-Control-Request-Method: POST' \
  https://finance.orpira.es/api/trial-start
curl -sS -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://finance.orpira.es' \
  -H 'Access-Control-Request-Method: POST' \
  https://finance.orpira.es/api/trial-start
for endpoint in trial-start automation-token automation ai-provider-openai; do
  curl -sS -D - -o /dev/null "https://finance.orpira.es/api/${endpoint}"
done
curl -sS -D - -o /dev/null https://finance.orpira.es/api/communication-channel
curl -sS -D - -o /dev/null https://finance.orpira.es/.well-known/security.txt
openssl s_client -connect finance.orpira.es:443 -servername finance.orpira.es -tls1_3 </dev/null
openssl s_client -connect finance.orpira.es:443 -servername finance.orpira.es -tls1_2 </dev/null
dig orpira.es CAA
dig orpira.es DS
```

Resumen observado:

| Prueba | Resultado |
| --- | --- |
| HTTP a HTTPS | `308` permanente |
| Homepage HTTPS | `200`; HSTS presente; sin CSP/X-Frame-Options/nosniff/referrer/permissions |
| TLS 1.3 | Negociado con suite AEAD moderna |
| TLS 1.2 | Negociado con ECDHE + AES-GCM |
| Certificado | Validación correcta para `*.orpira.es`; vigente 2026-08-07 a 2026-11-05 durante la prueba |
| CORS origen no confiable en APIs | `403` |
| CORS same-origin | `204`, origen permitido y `Vary: Origin` |
| GET en cuatro endpoints POST-only | `405` controlado |
| API channel sin bearer | `500` en el despliegue examinado; el cuerpo no se evaluó porque el comando lo descartó y PB-SEC-026 corrige la atribución original |
| `/.well-known/security.txt` | `404` |
| DNSSEC | No se observó un registro `DS` desde el resolver usado; no se conserva evidencia suficiente para concluir sobre `DNSKEY` |

Los resultados pueden cambiar por despliegue, CDN, WAF, región o configuración de proveedor. Las salidas completas saneadas no forman parte del repositorio, por lo que estas filas deben tratarse como observaciones fechadas y revalidarse. Conservar headers, comando, región y fecha en el retest formal sin registrar tokens, cookies o datos personales.

## 12. Limitaciones y garantía

Este informe refleja el commit `b56c231` y el comportamiento observable durante la fecha indicada. El documento fue redactado fuera de ese commit y el árbol de trabajo contiene cambios posteriores, que no deben confundirse con el snapshot. No demuestra ausencia total de vulnerabilidades ni sustituye un pentest autenticado o una revisión de infraestructura con acceso a los paneles de los proveedores. La ausencia de evidencia de intrusión no equivale a evidencia de ausencia.

Los hallazgos marcados como condicionales deben verificarse en configuración real antes de afirmar exposición efectiva. Los conteos de `npm audit` pueden cambiar con el registro aun sin modificar el lockfile. La remediación local de PB-SEC-001 no está cerrada hasta integrarse y probarse en un entorno controlado. Las correcciones deben implementarse en cambios pequeños y auditables, sin alterar cálculos financieros ni balances históricos.
