# Política de seguridad

Este documento cubre cómo reportar una vulnerabilidad de seguridad en Private Balance. Para el modelo de seguridad técnico ya implementado (superficie de ataque, controles, riesgos abiertos), ver [docs/architecture/11_SECURITY.md](docs/architecture/11_SECURITY.md).

## Versiones soportadas

El proyecto no publica versiones estables numeradas todavía; se trabaja sobre `main` en desarrollo activo. Hasta que exista un esquema de versiones formal, considera soportada únicamente la última revisión de `main`.

## Cómo reportar una vulnerabilidad

**No abras un issue público para una vulnerabilidad activa o explotable.**

Reporta de forma privada a:

```text
[CONFIGURAR CORREO DE SEGURIDAD]
```

Si prefieres otro canal privado ya verificado por el propietario del repositorio, puedes usarlo en su lugar.

## Qué incluir en el reporte

- Descripción del problema y su impacto potencial.
- Pasos para reproducirlo (idealmente mínimos).
- Versión/commit afectado.
- Si aplica: si el problema compromete datos financieros locales, licencias, secretos de servidor o integraciones (n8n, WhatsApp/Evolution API, IA).
- Cualquier evidencia (logs, capturas) **sin incluir datos personales o financieros reales de terceros**.

## Divulgación responsable

Pedimos divulgación responsable: danos tiempo razonable para investigar y corregir antes de hacer pública cualquier información sobre la vulnerabilidad. No accedas, modifiques ni exfiltres datos que no sean tuyos al probar un hallazgo.

## Alcance

Aplica al código de este repositorio: cliente web/PWA, empaquetado Android, funciones serverless en `api/` y utilidades en `server/`. No cubre la infraestructura operativa de terceros (n8n, Neon, Evolution API) más allá de cómo este repositorio se integra con ellas.

## Secretos y claves de firma

- Las claves privadas (de firma de licencias o de cualquier otro propósito) **nunca** deben almacenarse en Git, en ningún archivo, rama, tag ni commit, aunque sea de un entorno de prueba.
- Las claves privadas deben generarse y mantenerse fuera del repositorio; los scripts de este proyecto (`scripts/generate-license-keys.mjs`) aceptan una ruta de salida arbitraria — nunca uses una ruta dentro del árbol del repositorio para la clave privada.
- Las claves **públicas** sí pueden incluirse en el código fuente cuando son necesarias para verificación (por ejemplo, `publicLicenseKeyJwk` en `src/services/signedLicenseService.ts` y `server/automationSecurity.ts`).
- Los archivos de licencias o claves de **producción** no deben usarse como fixtures de pruebas ni de ejemplos de documentación. Los tests usan device codes y claves claramente sintéticos (ver `test/automationGateway.test.ts`).
- Ante cualquier exposición confirmada o sospechada de una clave privada, esa clave debe considerarse comprometida de inmediato y rotarse siguiendo [docs/KEY_ROTATION_RUNBOOK.md](docs/KEY_ROTATION_RUNBOOK.md), sin esperar confirmación de explotación activa.
