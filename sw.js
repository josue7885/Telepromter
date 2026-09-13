const CACHE_NAME = "livevoz-teleprompter-v14-1";
const APP_SHELL = [
  "./app",
  "./teleprompter-v11.html",
  "./teleprompter.html",
  "./livevoz-v11-runtime.js",
  "./livevoz-v13-bridge.js",
  "./livevoz-v13-2-sync.js",
  "./livevoz-v14-runtime.js",
  "./livevoz-v14-cloud.js",
  "./livevoz-v14-1-polish.js",
  "./manifest.webmanifest",
  "./livevoz-logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_LIVEVOZ_CACHE") event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = request.mode === "navigate" || url.pathname.endsWith("/app") || url.pathname.endsWith("teleprompter-v11.html") || url.pathname.endsWith("teleprompter.html");
  if (isNavigation) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: "no-store" });
        if (fresh.ok) (await caches.open(CACHE_NAME)).put(request, fresh.clone());
        return fresh;
      } catch (_e) {
        return (await caches.match(request)) || (await caches.match("./app")) || (await caches.match("./teleprompter-v11.html"));
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = fetch(request).then(async response => {
      if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || await networkPromise || new Response("Offline", { status: 503, statusText: "Offline" });
  })());
});