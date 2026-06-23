# Checklist de pruebas de seguridad

## Licencias

- [ ] Una licencia V2 válida activa la app en el dispositivo correcto.
- [ ] Una licencia V2 vencida bloquea el acceso y muestra estado expirado.
- [ ] Una licencia V2 `lifetime` funciona con `expiresAt: null`.
- [ ] Una licencia V2 generada para otro `deviceCode` falla.
- [ ] Una licencia V2 modificada manualmente falla por firma inválida.
- [ ] La app sin licencia muestra la pantalla de activación.
- [ ] Una licencia V1 ya activa sigue funcionando durante la transición.
- [ ] Una licencia V1 nueva sigue aceptándose solo como compatibilidad temporal.
- [ ] Cambiar la fecha del dispositivo hacia atrás genera advertencia o bloqueo por `lastValidAccessDate`.

## Web/PWA

- [ ] `npm run build` compila sin errores TypeScript.
- [ ] La app web arranca y muestra el modo PWA/web sin bloquear.
- [ ] PIN, Dashboard, Ingresos, Egresos, Agenda, Temporadas y Reportes funcionan tras activar licencia.
- [ ] Ocultar valores sigue funcionando.
- [ ] Backup local cifrado exporta e importa correctamente.

## Android

- [ ] `npx cap sync android` termina sin errores.
- [ ] APK debug funciona tras los cambios de licencias.
- [ ] Release con R8/ProGuard compila con `./gradlew assembleRelease`.
- [ ] AAB release compila con `./gradlew bundleRelease`.
- [ ] Release no rompe Capacitor ni el WebView.
- [ ] Descarga/compartir archivos sigue funcionando.
- [ ] Notificaciones locales de Agenda siguen funcionando.
- [ ] Google Drive App Folder sigue conectando y subiendo backups si está configurado.

## Play Integrity

- [ ] En web/PWA `checkPlayIntegrity()` retorna `available: false` sin bloquear.
- [ ] En Android, antes de backend, `checkPlayIntegrity()` retorna estado no bloqueante documentado.
- [ ] Cuando exista backend, se valida nonce y verdict de Play Integrity en servidor.
