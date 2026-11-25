// Workbox imports this before adding its cache-first precache route.
const scope = self.registration.scope;
const htmlByPath = new Map(['', 'index.html', 'racer.html', 'workshop.html'].map((path) => [
  new URL(path, scope).pathname,
  new URL(path || 'index.html', scope).href,
]));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;

  const url = new URL(request.url);
  const fallbackUrl = htmlByPath.get(url.pathname);
  if (url.origin !== self.location.origin || !fallbackUrl) return;

  event.respondWith(loadPage(url, fallbackUrl));
});

async function loadPage(url, fallbackUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  let response;
  try {
    // Give shared caches a fresh HTML URL without changing the address bar or the app's query.
    const nonce = crypto.randomUUID?.() ?? crypto.getRandomValues(new Uint32Array(4)).join('-');
    url.searchParams.set('_br_reload', nonce);
    response = await fetch(url, { cache: 'no-store', redirect: 'manual', signal: controller.signal });
    if (response.ok || response.type === 'opaqueredirect') return response;
  } catch {
    // Offline or the network timed out.
  } finally {
    clearTimeout(timeout);
  }

  // Workbox stores HTML under revisioned keys. The request's query string (including
  // the Android TV wrapper's timestamp) stays in the address bar for the app to read.
  const cached = await caches.match(fallbackUrl, {
    cacheName: `brainracer-precache-v2-${scope}`,
    ignoreSearch: true,
  });
  return cached ?? response ?? Response.error();
}
