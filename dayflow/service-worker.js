const CACHE_NAME = 'dayflow-v1'

const STATIC_ASSETS = [
  '/index.html',
  '/app.html',
  '/css/style.css',
  '/css/admin.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/supabase.js',
  '/js/confetti.js',
  '/js/calendar.js',
  '/js/categories.js',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first: tenta rede, cai para cache se offline
self.addEventListener('fetch', event => {
  // Ignora requisições não-GET e externas (Supabase, Google Fonts, etc.)
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
