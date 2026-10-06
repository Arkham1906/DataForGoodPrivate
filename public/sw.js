// Service worker de DataForGood: muestra las notificaciones push y, al tocarlas, abre su enlace.
// Lo registra lib/notificaciones/registro-push.ts con alcance en el basePath (/dataforgood/).
// El servidor manda { titulo, mensaje, url, etiqueta, icono, insignia } (lib/notificaciones/push.ts).
// No guarda nada en caché: la app no funciona sin conexión.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let aviso;
  try {
    aviso = event.data.json();
  } catch {
    aviso = { titulo: "DataForGood", mensaje: event.data.text() };
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(aviso.titulo || "DataForGood", {
        body: aviso.mensaje || "",
        icon: aviso.icono,
        badge: aviso.insignia,
        // La misma notificación no se muestra dos veces.
        tag: aviso.etiqueta,
        data: { url: aviso.url },
      }),
      // Si la app está abierta, la campana se actualiza sin esperar al siguiente minuto.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((ventanas) => ventanas.forEach((v) => v.postMessage({ tipo: "notificacion-nueva" }))),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || self.registration.scope, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si la app ya está abierta, se reutiliza esa pestaña o ventana.
      const abierta = ventanas.find((v) => v.url.startsWith(self.registration.scope));
      if (abierta) return abierta.navigate(destino).then((v) => (v ?? abierta).focus());
      return self.clients.openWindow(destino);
    })
  );
});
