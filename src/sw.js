/**
 * sw.js — CarbonLite Service Worker
 * ==================================
 * Implements a cache-first strategy for all core app assets.
 * Enables offline use after the first load.
 */

const CACHE_NAME = 'carbonlite-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './scripts/app.js',
  './scripts/activityLogger.js',
  './scripts/dashboard.js',
  './scripts/insightsEngine.js',
  './scripts/onboarding.js',
  './scripts/storage.js',
  './scripts/validation.js',
  './scripts/simulator.js',
  './scripts/challenges.js',
  './data/emissionFactors.js',
];

// ── Install: pre-cache core assets ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove stale caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first, fallback to network ──────────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin && !url.href.includes('fonts.googleapis') && !url.href.includes('cdn.jsdelivr')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses for core assets
        if (response.ok && event.request.url.includes(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
