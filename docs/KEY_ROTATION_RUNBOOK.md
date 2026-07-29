# Key Rotation Runbook — Licencias firmadas V2

Documento operativo privado. Describe cómo reconocer una posible exposición de la clave privada de firma de licencias, cómo rotarla y, si fuera necesario, cómo purgar el historial de Git. **No contiene ningún secreto.** Está pensado para el propietario del repositorio, no para publicación externa con contexto adicional que facilite un ataque.

## Contexto del incidente que originó este runbook

Durante una auditoría documental (2026-07-28) se detectaron dos archivos en la raíz del repositorio, rastreados por Git, con material JWK:

- `PB-9DB2-FBCE-EA10` — contiene el campo privado `d` (clave privada EC).
- `lifetime` — sin campo `d`; es el componente público del mismo par.

Un cotejo estructural seguro (comparación de huellas, sin imprimir valores) confirmó que:

- Ambos archivos forman un par de claves EC coherente entre sí.
- Ese par **no coincide** con la clave pública actualmente embebida en `src/services/signedLicenseService.ts` / `server/automationSecurity.ts` (la que la app usa realmente para verificar licencias en producción).

Hipótesis más probable: `scripts/generate-license-keys.mjs` acepta rutas de salida arbitrarias como argumentos (`node scripts/generate-license-keys.mjs <privada> <pública>`). Es probable que se haya invocado con el device code y el tipo de licencia como nombres de archivo (posiblemente por confusión con la sintaxis de `generate-signed-license.mjs`, que sí toma `<deviceCode> <licenseType>` como argumentos), generando un par de claves nuevo con esos nombres en la raíz del repositorio en lugar de los nombres por defecto ya protegidos por `.gitignore`.

Esto reduce la probabilidad de que licencias de producción reales puedan haberse firmado con la clave expuesta, pero **no la elimina**: solo el propietario, revisando su propio historial de comandos y despliegues, puede confirmarlo con certeza. Hasta esa confirmación, la clave debe tratarse como comprometida.

Acción de contención ya aplicada en esta rama: ambos archivos se retiraron del índice de Git (`git rm --cached`, conservando la copia local) y se añadieron patrones específicos a `.gitignore`. Esto **no** elimina el material del historial de Git; ver [Plan de purga del historial](#plan-de-purga-del-historial).

## 0. Clave de trial: un perfil de riesgo distinto

Todo lo anterior en este runbook describe la clave de licencias **de pago**,
que solo se usa offline. Desde la introducción del trial autoservicio de 7
días existe una **segunda clave, independiente**, `TRIAL_LICENSE_PRIVATE_KEY_JWK`,
que sí vive como variable de entorno en el runtime de Vercel (ver
`docs/LICENSE_DEVICE_REGISTRY.md#prueba-gratuita-de-7-días-trial-autoservicio`).

Esto es una decisión deliberada, no un descuido: la clave de trial necesita
firmar automáticamente en cada solicitud, así que no puede quedarse offline
como la de pago. A cambio, si se filtrara, el daño se limita a permitir
generar pruebas gratuitas de 7 días — nunca licencias de pago ni acceso
indefinido. Aun así, trátala con el mismo cuidado operativo:

- Rotarla sigue el mismo procedimiento (`generate-license-keys.mjs`), pero
  el nuevo valor se actualiza en las variables de entorno de Vercel, no en
  un archivo local — y la nueva clave pública debe copiarse en **dos**
  sitios que deben coincidir exactamente: `server/trialLicenseSecurity.ts`
  y `src/services/signedLicenseService.ts`.
- Si alguna vez se sospecha de exposición, rota primero esta clave (impacto
  bajo, sin usuarios de pago afectados) y evalúa la clave de pago por
  separado según el resto de este documento.

## 1. Cómo reconocer una posible exposición

Señales de alerta:

- Un archivo con estructura JWK (`kty`, `crv`, `x`, `y`, y especialmente `d`) rastreado por Git, en cualquier commit, rama o tag.
- Un archivo `.pem` con cabecera `BEGIN PRIVATE KEY` o `BEGIN EC PRIVATE KEY` rastreado por Git.
- Cualquier archivo de salida de `scripts/generate-license-keys.mjs` con un nombre distinto a los dos únicos nombres ya cubiertos por `.gitignore` (`license-private-key.json`, `license-private-key.pem`).
- Variables de entorno con material de clave (`LICENSE_PRIVATE_KEY_JWK`) presentes en un archivo versionado en lugar de `.env.local`/`.env` (ya ignorados).

Comprobación segura (no imprime contenido):

```bash
git ls-files | grep -iE '(private|secret|key)' 
git log --all --diff-filter=A --format='%h %ad %s' --date=iso -- <ruta-sospechosa>
git branch --all --contains <hash-del-commit>
```

## 2. Cómo generar un nuevo par de claves localmente

```bash
node scripts/generate-license-keys.mjs
```

Sin argumentos, escribe exactamente `license-private-key.json` y `license-public-key.json` en la raíz — ambos ya cubiertos por `.gitignore`. **No** pases rutas personalizadas dentro del árbol del repositorio; si necesitas otro nombre, usa una ruta absoluta fuera del repositorio:

```bash
node scripts/generate-license-keys.mjs /ruta/segura/fuera-del-repo/license-private-key.json /ruta/segura/fuera-del-repo/license-public-key.json
```

## 3. Cómo preservar únicamente la clave pública necesaria

Solo la clave **pública** (`license-public-key.json`) debe copiarse dentro del código fuente. Formato esperado (ejemplo saneado, sin material real):

```json
{
  "kty": "EC",
  "crv": "P-256",
  "x": "REPLACE_WITH_PUBLIC_COMPONENT",
  "y": "REPLACE_WITH_PUBLIC_COMPONENT",
  "key_ops": ["verify"],
  "ext": true
}
```

La clave privada (con el campo `d`) **nunca** debe copiarse a ningún archivo dentro del repositorio, variable `VITE_*`, log o issue.

## 4. Cómo sustituir referencias

La clave pública vive embebida (no importada desde un archivo) en dos puntos, que deben actualizarse juntos:

- `src/services/signedLicenseService.ts` → constante `publicLicenseKeyJwk`.
- `server/automationSecurity.ts` → misma constante, usada para validar licencias en el backend de automatización.

No existe un tercer punto conocido; confirma con `git grep -n "publicLicenseKeyJwk"` antes de dar la sustitución por completa.

## 5. Cómo invalidar o dejar de confiar en la clave anterior

Una vez sustituida la constante en ambos archivos y desplegado el cambio, la clave anterior deja de poder verificar nada: `signedLicenseService.ts` solo confía en la clave embebida en el propio bundle. No hace falta una "lista de revocación" adicional salvo que se implemente el periodo de transición descrito en la sección de rotación del [Plan de rotación](#plan-de-rotación-recomendado).

## 6. Cómo regenerar licencias si aplica

```bash
node scripts/generate-signed-license.mjs <DEVICE_CODE> lifetime
node scripts/generate-signed-license.mjs <DEVICE_CODE> demo 2026-12-31
node scripts/generate-signed-license.mjs <DEVICE_CODE> monthly 2026-08-31
node scripts/generate-signed-license.mjs <DEVICE_CODE> annual 2027-07-31
```

El generador lee la clave privada desde `LICENSE_PRIVATE_KEY_JWK` (variable de entorno), `LICENSE_PRIVATE_KEY_PATH` (ruta a archivo) o, por defecto, `./license-private-key.json`. Usa siempre la nueva clave privada tras una rotación.

## 7. Cómo probar verificación y rechazo

1. Genera una licencia de prueba con la nueva clave privada para un `deviceCode` de prueba.
2. Actívala en un entorno de desarrollo y confirma que `signedLicenseService.ts` la acepta.
3. Intenta activar (en el mismo entorno ya actualizado) una licencia firmada con la clave **anterior**: debe ser rechazada si no se implementó periodo de transición, o aceptada solo si el periodo de transición está vigente.
4. Ejecuta `npm run test` — la suite incluye pruebas de licencias (`test/licenseRegistry.test.ts`, `test/licenseCommunicationSeparation.test.ts`) que deben seguir en verde.

## 8. Cómo desplegar

1. Actualiza la clave pública en ambos archivos (sección 4).
2. Genera y prueba localmente (secciones 6 y 7).
3. Despliega el cambio de cliente (web/Vercel) y de servidor (`api/`, `server/`) en el mismo despliegue: cliente y servidor deben confiar en la misma clave pública desde el mismo momento.
4. Sincroniza y publica el build de Android (`npm run android:sync`, `npm run android:apk`) para que las instalaciones existentes reciban la nueva verificación en la próxima actualización.

## 9. Cómo auditar el repositorio

```bash
git log --all --diff-filter=A --name-only --format='%h %ad' --date=short | grep -iE '(private|secret|\.pem$)'
git ls-files | grep -iE '(private|secret|\.pem$|^PB-)'
```

Repite la comprobación de fingerprints (sección de contexto de este runbook) cada vez que aparezca un archivo JWK sospechoso, sin imprimir sus valores.

## Plan de rotación recomendado

**Urgencia:** alta para el archivo `PB-9DB2-FBCE-EA10` en sí (debe considerarse comprometido y no debe reutilizarse jamás), pero **no crítica para las licencias de producción actuales**, dado que el cotejo estructural indica que esta clave expuesta no es la que usa `signedLicenseService.ts`/`automationSecurity.ts` hoy. El propietario debe confirmar esto revisando si esa clave llegó a usarse alguna vez para firmar una licencia real entregada a un cliente.

Componentes que usan la clave pública actual:

- `src/services/signedLicenseService.ts` (verificación en cliente/APK).
- `server/automationSecurity.ts` (verificación en backend de automatización).

Componentes que esperan la clave privada (nunca deben tenerla embebida, solo recibirla por entorno o archivo local):

- `scripts/generate-signed-license.mjs`.

Variables de entorno implicadas: `LICENSE_PRIVATE_KEY_JWK`, `LICENSE_PRIVATE_KEY_PATH` (solo en el entorno de quien genera licencias, nunca en Vercel/cliente).

Servicios de despliegue implicados: build web/Vercel y build Android (ambos consumen el mismo código fuente con la clave pública embebida).

Licencias potencialmente afectadas por una rotación: cualquier licencia V2 ya firmada con la clave anterior, incluidas las activas en dispositivos reales.

Tests que deben revisarse tras rotar: `test/licenseRegistry.test.ts`, `test/licenseCommunicationSeparation.test.ts`, y cualquier fixture que use un JWK de ejemplo embebido en un test.

### Opción A — Rotación inmediata incompatible

La nueva versión deja de aceptar licencias firmadas con la clave anterior. Más simple, pero invalida instantáneamente todas las licencias activas emitidas hasta ahora; requiere reemitir licencias a todos los dispositivos activos antes o inmediatamente después del despliegue.

### Opción B — Rotación con periodo de transición

La app acepta temporalmente ambas claves públicas (anterior y nueva); las licencias **nuevas** se firman solo con la nueva clave; la clave anterior se retira del código tras un periodo de transición acordado. Requiere modificar `signedLicenseService.ts`/`automationSecurity.ts` para aceptar una lista de claves públicas confiables en lugar de una sola constante — **este es un cambio de modelo de confianza y no debe implementarse sin autorización explícita del propietario**, tal como exige esta fase.

**Decisión pendiente del propietario:** elegir entre Opción A y Opción B, y confirmar si la clave expuesta llegó a firmar alguna licencia real entregada.

## Plan de purga del historial

**No se ejecutó ninguna purga.** Esto es solo el plan, para revisión y autorización expresa.

### ¿Es necesaria?

Sí, como buena práctica de higiene, independientemente del impacto real: una clave privada rastreada en Git —aunque no sea la de producción actual— no debe permanecer en el historial. El propietario debe autorizar explícitamente su ejecución.

### Referencias a limpiar

- Commit de introducción: `5930ac4` ("fix:automatizacion ingresos", 2026-07-04).
- Ese commit es ancestro de `origin/main` y de todas las ramas locales y remotas listadas en el informe: `main`, `chore/repository-lint-cleanup`, `feature/insight-engine-foundation`, `feature/insight-rules-catalog`, `release/snapshot-multiconsumer-rc1`, `backup/main-before-sync-2026-07-17`, y sus equivalentes en `origin/*`.
- Tags que lo contienen: `knowledge-layer-rc.1`, `pb-docs-v1`, `snapshot-adoption-rc.1`, `snapshot-foundation-v1.0.0`, `snapshot-multiconsumer-rc.1`, `v0.10-ai-foundation-runtime`, `v0.16.0`, `v0.17.2`, `v0.9.0`.

### Herramienta recomendada

`git filter-repo` (mantenida activamente y recomendada por GitHub). BFG Repo-Cleaner como alternativa si `filter-repo` no está disponible.

### Comandos (no ejecutados — solo referencia para cuando el propietario autorice)

```bash
# 1) Clon espejo de respaldo, nunca trabajar sobre el original
git clone --mirror https://github.com/Orpira/finance-app.git finance-app-mirror-backup.git
cd finance-app-mirror-backup.git

# 2) Confirmar que la clave ya fue rotada (sección "Plan de rotación") ANTES de purgar

# 3) Eliminar los archivos de todas las referencias (rama, tags, historial completo)
git filter-repo --invert-paths --path PB-9DB2-FBCE-EA10 --path lifetime

#    Alternativa con BFG:
#    bfg --delete-files PB-9DB2-FBCE-EA10 finance-app-mirror-backup.git
#    bfg --delete-files lifetime finance-app-mirror-backup.git

# 4) Revisar ramas
git branch -a

# 5) Revisar tags
git tag

# 6) Garbage collection
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 7) Force push coordinado (requiere autorización explícita y ventana de mantenimiento)
git push --force --all origin
git push --force --tags origin

# 8) Invalidar clones anteriores: notificar a cualquier colaborador con clon local.
# 9) Pedir a todos los colaboradores que vuelvan a clonar desde cero (no rebasar el clon viejo).
# 10) Revisar cachés/artefactos/releases/paquetes publicados que puedan contener el blob.
# 11) Verificar nuevamente el historial:
git log --all --diff-filter=A -- PB-9DB2-FBCE-EA10 lifetime   # debe no devolver nada

# 12) Si GitHub ya cacheó el objeto (forks, pull requests, Actions), contactar al soporte de
#     GitHub para solicitar la purga de objetos cacheados fuera del repositorio principal.
```

**Advertencias explícitas:**

- Esto **reescribe hashes de todos los commits posteriores** al de introducción, en todas las ramas y tags afectados.
- Requiere **coordinación** con cualquier persona que tenga un clon local: sus ramas locales divergirán irreconciliablemente del historial reescrito.
- **Requiere force push** a todas las ramas remotas afectadas.
- Puede romper referencias en Pull Requests abiertos, forks y cualquier integración (CI, bots) que dependa de hashes de commit específicos.
- **No debe ejecutarse sin autorización expresa del propietario**, y solo después de rotar la clave.
