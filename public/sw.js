// Service worker aplikasi operasional (didaftarkan dengan scope /operasional/ oleh PushToggle).
// Hanya menangani notifikasi push. Sengaja TANPA cache app-shell dan TANPA handler fetch: situs publik dan
// cache halaman di worker.ts tidak boleh terganggu.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const tag = data.tag || "istana-block";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Istana Block", {
        body: data.body || "Ada pembaruan di aplikasi operasional.",
        icon: "/brand/logo-istana-block.png",
        badge: "/brand/logo-istana-block.png",
        tag,
        renotify: Boolean(data.tag),
        requireInteraction: tag.startsWith("calendar-"),
        vibrate: [200, 100, 200],
        data: { url: data.url || "/operasional" },
      }),
      // Halaman yang sedang terbuka bisa memuat ulang datanya.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => list.forEach((client) => client.postMessage({ type: "push", tag: data.tag || null }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      let target = new URL("/operasional", self.location.origin);
      try {
        const wanted = new URL(event.notification.data?.url || "/operasional", self.location.origin);
        if (wanted.origin === self.location.origin) target = wanted;
      } catch {
        // alamat rusak: buka beranda operasional
      }
      const existing = list.find((client) => "focus" in client && client.url.startsWith(self.location.origin + "/operasional"));
      if (existing) return existing.focus().then((client) => ("navigate" in client ? client.navigate(target.href) : client));
      return self.clients.openWindow(target.href);
    }),
  );
});
