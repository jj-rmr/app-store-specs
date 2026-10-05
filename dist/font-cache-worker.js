const FONT_CACHE = "launchpad-fonts-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.destination !== "font") return;

  event.respondWith(
    caches.open(FONT_CACHE).then(async (cache) => {
      const cachedFont = await cache.match(event.request);
      if (cachedFont) return cachedFont;

      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }),
  );
});
