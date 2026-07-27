/**
 * Este proyecto no registra ningún service worker propio (vite-plugin-pwa no está
 * habilitado en vite.config.ts). Si el navegador tiene uno activo para este origen
 * —típicamente un remanente de otro proyecto servido antes en el mismo puerto de
 * Vite— lo elimina y limpia su caché, forzando una recarga si ya estaba
 * controlando la página actual.
 */
const RELOADED_ONCE_KEY = 'finance-app:sw-cleanup-reloaded'

export async function unregisterStaleServiceWorkers() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()

  if (registrations.length === 0) {
    return
  }

  const hadController = Boolean(navigator.serviceWorker.controller)

  await Promise.all(registrations.map((registration) => registration.unregister()))

  if (typeof caches !== 'undefined') {
    const cacheKeys = await caches.keys()
    await Promise.all(cacheKeys.map((key) => caches.delete(key)))
  }

  // Nunca recargar más de una vez por pestaña: si algo (otra extensión, otro
  // proceso) sigue re-registrando un service worker en cada carga, forzar un
  // reload en bucle dejaría la app aparentando estar congelada.
  if (
    hadController &&
    typeof window !== 'undefined' &&
    typeof sessionStorage !== 'undefined' &&
    !sessionStorage.getItem(RELOADED_ONCE_KEY)
  ) {
    sessionStorage.setItem(RELOADED_ONCE_KEY, 'true')
    window.location.reload()
  }
}
